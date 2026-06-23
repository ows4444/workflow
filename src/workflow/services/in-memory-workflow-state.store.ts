import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowStateStore } from '../contracts/workflow-state-store';
import { WorkflowConcurrencyError } from '../errors/workflow.errors';

@Injectable()
export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  private readonly states = new Map<string, WorkflowExecutionState>();

  async insert(state: WorkflowExecutionState): Promise<void> {
    if (this.states.has(state.workflowId)) {
      throw new WorkflowConcurrencyError(
        `Workflow '${state.workflowId}' already exists`,
      );
    }

    this.states.set(state.workflowId, state);
  }

  async findRunning() {
    return this.values().filter((x) => x.status === 'running');
  }

  async findWaiting() {
    return this.values().filter((x) => x.status === 'waiting');
  }

  async findFailed() {
    return this.values().filter((x) => x.status === 'failed');
  }

  async findStuck(olderThanMs: number) {
    const threshold = Date.now() - olderThanMs;

    return this.values().filter(
      (x) =>
        x.status === 'running' &&
        x.stepStartedAt &&
        x.stepStartedAt.getTime() < threshold,
    );
  }

  async save(
    previousState: WorkflowExecutionState,
    nextState: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    const existing = this.states.get(nextState.workflowId);

    if (!existing) {
      throw new WorkflowConcurrencyError(
        `Workflow '${nextState.workflowId}' not found`,
      );
    }

    if (existing.stateVersion !== previousState.stateVersion) {
      throw new WorkflowConcurrencyError(
        `Workflow '${nextState.workflowId}' version mismatch`,
      );
    }

    this.states.set(nextState.workflowId, nextState);

    return nextState;
  }

  async load(workflowId: string): Promise<WorkflowExecutionState | null> {
    return this.states.get(workflowId) ?? null;
  }

  async delete(workflowId: string): Promise<void> {
    this.states.delete(workflowId);
  }

  private values(): WorkflowExecutionState[] {
    return [...this.states.values()];
  }
}
