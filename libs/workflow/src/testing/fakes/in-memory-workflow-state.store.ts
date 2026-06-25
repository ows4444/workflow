import { Injectable } from '@nestjs/common';

import { WorkflowStateStore } from '../../ports/workflow-state-store';
import { WorkflowConcurrencyError } from '../../errors/workflow.errors';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';

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
  async findRecoverable(readyAt = new Date(), limit?: number) {
    const results = this.values().filter(
      (x) =>
        x.requiresRecovery === true && (!x.retryAt || x.retryAt <= readyAt),
    );

    return limit === undefined ? results : results.slice(0, limit);
  }

  async findRunning() {
    return this.values().filter((x) => x.status === 'running');
  }

  async findWaiting() {
    return this.values().filter((x) => x.status === 'waiting');
  }

  async findWaitingExpired(olderThanMs: number, limit?: number) {
    const threshold = Date.now() - olderThanMs;

    const results = this.values().filter(
      (x) => x.status === 'waiting' && x.updatedAt.getTime() < threshold,
    );

    return limit === undefined ? results : results.slice(0, limit);
  }

  async findFailed() {
    return this.values().filter((x) => x.status === 'failed');
  }

  async findStuck(olderThanMs: number, limit?: number) {
    const threshold = Date.now() - olderThanMs;

    const results = this.values().filter(
      (x) =>
        x.status === 'running' &&
        x.stepStartedAt &&
        x.stepStartedAt.getTime() < threshold,
    );

    return limit === undefined ? results : results.slice(0, limit);
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

  async renewLease(
    workflowId: string,
    owner: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const state = this.states.get(workflowId);

    if (!state || state.leaseOwner !== owner) {
      return false;
    }

    this.states.set(workflowId, {
      ...state,
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

  async deleteCompleted(
    workflowName?: string,
    workflowVersion?: number,
    olderThanMs = 0,
  ): Promise<number> {
    const threshold = Date.now() - olderThanMs;

    let deleted = 0;

    for (const [id, state] of this.states) {
      if (state.status !== 'completed' || !state.completedAt) {
        continue;
      }

      if (state.completedAt.getTime() >= threshold) {
        continue;
      }

      if (workflowName && state.workflowName !== workflowName) {
        continue;
      }

      if (
        workflowVersion !== undefined &&
        state.workflowVersion !== workflowVersion
      ) {
        continue;
      }

      this.states.delete(id);
      deleted++;
    }

    return deleted;
  }

  async findCompleted(
    workflowName?: string,
    workflowVersion?: number,
    olderThanMs = 0,
    limit?: number,
  ): Promise<WorkflowExecutionState[]> {
    const threshold = Date.now() - olderThanMs;

    return this.values()
      .filter((state) => {
        if (state.status !== 'completed' || !state.completedAt) {
          return false;
        }

        if (state.completedAt.getTime() >= threshold) {
          return false;
        }

        if (workflowName && state.workflowName !== workflowName) {
          return false;
        }

        if (
          workflowVersion !== undefined &&
          state.workflowVersion !== workflowVersion
        ) {
          return false;
        }

        return true;
      })
      .slice(0, limit);
  }
}
