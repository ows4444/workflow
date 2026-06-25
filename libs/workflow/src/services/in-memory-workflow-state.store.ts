import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowStateStore } from '../contracts/stores/workflow-state-store';
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
  async findRecoverable() {
    return this.values().filter((x) => x.requiresRecovery === true);
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

  async acquireLease(
    workflowId: string,
    owner: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const state = this.states.get(workflowId);

    if (!state) {
      return false;
    }

    if (
      state.leaseExpiresAt &&
      state.leaseExpiresAt > new Date() &&
      state.leaseOwner !== owner
    ) {
      return false;
    }

    this.states.set(workflowId, {
      ...state,
      leaseOwner: owner,
      leaseExpiresAt: expiresAt,
    });

    return true;
  }

  async releaseLease(workflowId: string, owner: string): Promise<void> {
    const state = this.states.get(workflowId);

    if (!state || state.leaseOwner !== owner) {
      return;
    }

    this.states.set(workflowId, {
      ...state,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    });
  }

  async delete(workflowId: string): Promise<void> {
    this.states.delete(workflowId);
  }

  private values(): WorkflowExecutionState[] {
    return [...this.states.values()];
  }
}
