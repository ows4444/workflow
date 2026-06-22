import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowStateStore } from '../contracts/workflow-state-store';
import { WorkflowConcurrencyError } from '../errors/workflow.errors';

@Injectable()
export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  private readonly states = new Map<string, WorkflowExecutionState>();

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
    state: WorkflowExecutionState,
    expectedVersion?: number,
  ): Promise<void> {
    if (expectedVersion !== undefined) {
      const existing = this.states.get(state.workflowId);

      if (existing && existing.stateVersion !== expectedVersion) {
        throw new WorkflowConcurrencyError(
          `Workflow '${state.workflowId}' version mismatch`,
        );
      }
    }

    this.states.set(state.workflowId, state);
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
