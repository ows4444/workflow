import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_STUCK_THRESHOLD_MS } from '../constants/workflow.constants';
import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';
import { type WorkflowStateStore } from '../contracts/workflow-state-store';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowRecoveryService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,
    private readonly transitions: WorkflowStateTransitions,
  ) {}

  async findStuckExecutions() {
    const workflows =
      (await this.store.findStuck?.(DEFAULT_STUCK_THRESHOLD_MS)) ?? [];

    return workflows.filter((x) => x.status === 'running' && !!x.executingStep);
  }

  async markAsRecoverable(workflowId: string): Promise<void> {
    const state = await this.store.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    const next = this.transitions.markRecoverable(state, 'process-crash');

    await this.store.save(state, next);
  }
}
