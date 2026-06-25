import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';

@Injectable()
export class WorkflowRetryService {
  constructor(
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
  ) {}

  canRetry(state: WorkflowExecutionState, maxAttempts: number): boolean {
    if (state.status !== 'failed') {
      return false;
    }

    if (!state.lastFailure?.retriable) {
      return false;
    }

    return (state.failureCount ?? 0) < maxAttempts;
  }

  async retry(state: WorkflowExecutionState): Promise<WorkflowExecutionState> {
    const next = this.transitions.markRecoverable(
      this.transitions.incrementRetry(state),
      'unknown',
    );

    return this.stateService.save(state, next);
  }
}
