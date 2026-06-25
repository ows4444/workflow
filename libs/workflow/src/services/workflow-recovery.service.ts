import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_STUCK_THRESHOLD_MS } from '../constants/workflow.constants';
import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';

import { type WorkflowStateStore } from '../contracts/stores/workflow-state-store';

import { WorkflowExecutionError } from '../errors/workflow.errors';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

@Injectable()
export class WorkflowRecoveryService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,

    private readonly transitions: WorkflowStateTransitions,
  ) {}

  async findStuckExecutions(
    olderThanMs = DEFAULT_STUCK_THRESHOLD_MS,
    limit?: number,
  ) {
    const workflows = (await this.store.findStuck?.(olderThanMs, limit)) ?? [];

    return workflows.filter(
      (x) => x.status === 'running' && !!x.executingStep && !x.requiresRecovery,
    );
  }

  async findRecoverableExecutions(limit?: number) {
    return (await this.store.findRecoverable?.(new Date(), limit)) ?? [];
  }

  async findExpiredWaitingExecutions(
    timeoutMs: number,
    limit?: number,
  ): Promise<WorkflowExecutionState[]> {
    return (await this.store.findWaitingExpired?.(timeoutMs, limit)) ?? [];
  }

  async markAsRecoverable(workflowId: string): Promise<void> {
    const state = await this.store.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.requiresRecovery) {
      return;
    }

    const next = this.transitions.markRecoverable(state, 'process-crash');

    await this.store.save(state, next);
  }
}
