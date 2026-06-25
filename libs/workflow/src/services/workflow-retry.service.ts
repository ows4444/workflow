import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowRetryDelayService } from './workflow-retry-delay.service';
import { WorkflowRetryMetadata } from '../metadata/workflow-retry-metadata';

@Injectable()
export class WorkflowRetryService {
  constructor(
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
    private readonly retryDelay: WorkflowRetryDelayService,
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

  async retry(
    state: WorkflowExecutionState,
    retry: WorkflowRetryMetadata,
  ): Promise<WorkflowExecutionState> {
    const delay = this.retryDelay.compute(retry, (state.failureCount ?? 0) + 1);

    const next = this.transitions.markRecoverable(
      this.transitions.incrementStepRetry(state),
      'unknown',
      new Date(Date.now() + delay),
    );

    return this.stateService.save(state, next);
  }
}
