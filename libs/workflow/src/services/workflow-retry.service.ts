import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowRetryDelayService } from './workflow-retry-delay.service';
import { WorkflowRetryMetadata } from '../metadata/workflow-retry-metadata';
import { WorkflowLogger } from './workflow-logger.service';

@Injectable()
export class WorkflowRetryService {
  constructor(
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
    private readonly retryDelay: WorkflowRetryDelayService,
    private readonly logger: WorkflowLogger,
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

    const persisted = await this.stateService.save(state, next);

    if (persisted.retryAt) {
      this.logger.retryScheduled(persisted, persisted.retryAt);
    }

    return persisted;
  }
}
