import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_STUCK_THRESHOLD_MS } from '../constants/workflow.constants';
import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';

import { type WorkflowStateStore } from '../contracts/stores/workflow-state-store';

import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowRecoveryService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,
  ) {}

  async findStuckExecutions(olderThanMs = DEFAULT_STUCK_THRESHOLD_MS) {
    const workflows = (await this.store.findStuck?.(olderThanMs)) ?? [];

    return workflows.filter(
      (x) => x.status === 'running' && !!x.executingStep && !x.requiresRecovery,
    );
  }

  async findRecoverableExecutions() {
    return (await this.store.findRecoverable?.()) ?? [];
  }

  async markAsRecoverable(workflowId: string): Promise<void> {
    const state = await this.store.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    const next = { ...state };

    await this.store.save(state, next);
  }
}
