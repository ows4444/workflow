import { Inject, Injectable } from '@nestjs/common';
import { WorkflowCompensationService } from '../compensation/service';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowRetryService } from '../retry/retry.service';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowLifecyclePublisher } from './lifecycle.publisher';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowFailureError } from '../../errors';
import { WorkflowExecutionError } from '../../errors/workflow.errors';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowFailure } from '../../models/workflow-failure';
import { WorkflowLogger } from '../../observability/logger';
import { WorkflowHistoryService } from '../../persistence/history.service';
import { type WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';

@Injectable()
export class WorkflowFailureService {
  constructor(
    private readonly history: WorkflowHistoryService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
    private readonly retryService: WorkflowRetryService,
    private readonly compensation: WorkflowCompensationService,
    private readonly registry: WorkflowRegistry,
    private readonly publisher: WorkflowLifecyclePublisher,
    private readonly logger: WorkflowLogger,

    @Inject(WORKFLOW_TRANSACTION_RUNNER)
    private readonly transactionRunner: WorkflowTransactionRunner,
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

    const persisted = await this.transactionRunner.execute(async () => {
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

      return this.stateService.save(state, failedState);
    });

    this.logger.failed(persisted, error);

    const latest =
      (await this.stateService.load(persisted.workflowId)) ?? persisted;

    const workflow = this.registry.get(
      latest.workflowName,
      latest.workflowVersion,
    );

    this.transactionRunner.afterCommit?.(async () => {
      await this.publisher.failed(workflow, latest);

      const retry = workflow.metadata.retries;

      if (retry && this.retryService.canRetry(latest, retry.maxAttempts)) {
        await this.retryService.retry(latest, retry);
        return;
      }

      if (workflow.metadata.compensation?.enabled) {
        await this.compensation.compensate(workflow, latest);
      }
    });
  }
}
