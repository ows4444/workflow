import { Injectable } from '@nestjs/common';

import { WorkflowFailure } from '../contracts/workflow-failure';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowFailureError } from '../errors/workflow-failure.error';
import { WorkflowExecutionError } from '../errors/workflow.errors';

import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowRegistry } from './workflow.registry';
import { WorkflowRetryService } from './workflow-retry.service';
import { WorkflowLifecyclePublisher } from './workflow-lifecycle.publisher';

@Injectable()
export class WorkflowFailureService {
  constructor(
    private readonly history: WorkflowHistoryService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
    private readonly retryService: WorkflowRetryService,
    private readonly registry: WorkflowRegistry,
    private readonly publisher: WorkflowLifecyclePublisher,
  ) {}

  serialize(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async handleFailure(
    state: WorkflowExecutionState,
    error: unknown,
  ): Promise<void> {
    if (!state.executingStep && !state.currentStep) {
      return;
    }

    await this.failExecution(state, error);
  }

  toFailure(error: unknown): WorkflowFailure {
    if (error instanceof WorkflowFailureError) {
      return {
        code: error.constructor.name,
        message: error.message,
        retriable: error.retriable,
      };
    }

    if (error instanceof WorkflowExecutionError) {
      return {
        code: 'WORKFLOW_EXECUTION_ERROR',
        message: error.message,
        retriable: false,
      };
    }

    return {
      code: 'UNKNOWN',
      message: this.serialize(error),
      retriable: false,
    };
  }

  async failExecution(
    state: WorkflowExecutionState,
    error: unknown,
  ): Promise<void> {
    const failedAt = new Date();

    const failedStep = state.executingStep ?? state.currentStep;

    if (!failedStep) {
      return;
    }

    await this.history.append(state.workflowId, {
      step: failedStep,
      startedAt: state.stepStartedAt ?? failedAt,
      completedAt: failedAt,
      durationMs:
        failedAt.getTime() - (state.stepStartedAt ?? failedAt).getTime(),
      status: 'failed',
      error: this.serialize(error),
    });

    const failedState = this.transitions.failWorkflow(
      state,
      this.toFailure(error),
    );

    const persisted = await this.stateService.save(state, failedState);

    const latest =
      (await this.stateService.load(persisted.workflowId)) ?? persisted;

    const workflow = this.registry.get(
      latest.workflowName,
      latest.workflowVersion,
    );

    await this.publisher.failed(workflow, latest);

    const maxAttempts = workflow.metadata.retries?.maxAttempts ?? 0;

    if (this.retryService.canRetry(latest, maxAttempts)) {
      await this.retryService.retry(latest);
    }
  }
}
