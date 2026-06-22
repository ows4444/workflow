import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_STUCK_THRESHOLD_MS } from '../constants/workflow.constants';
import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';
import { type WorkflowStateStore } from '../contracts/workflow-state-store';

@Injectable()
export class WorkflowRecoveryService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,
  ) {}

  async findRecoverable() {
    return this.store.findStuck?.(DEFAULT_STUCK_THRESHOLD_MS) ?? [];
  }
}
