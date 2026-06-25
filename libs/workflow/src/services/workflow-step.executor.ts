import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_STEP_TIMEOUT_MS } from '../constants/workflow.constants';
import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowContext } from '../contracts/workflow-context';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepResult } from '../contracts/workflow-step-result';
import { WorkflowStepResolver } from './workflow-step-resolver';
import { WorkflowFailureError } from '../errors/workflow-failure.error';
import { WorkflowExecutionError } from '../errors/workflow.errors';
import { WorkflowRetryDelayService } from './workflow-retry-delay.service';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';
import { type WorkflowRetryJitter } from '../contracts/workflow-retry-jitter';
import {
  WORKFLOW_RETRY_JITTER,
  WORKFLOW_RETRY_SCHEDULER,
} from '../constants/workflow.tokens';
import { type WorkflowRetryScheduler } from '../contracts/workflow-retry-scheduler';
import { WorkflowLeaseService } from './workflow-lease.service';
import { WorkflowStepResultValidator } from './workflow-step-result.validator';
import { WorkflowStepPersistenceService } from './workflow-step-persistence.service';

interface RetryExecutionResult<T> {
  readonly result: T;
  readonly latestState: WorkflowExecutionState;
}

@Injectable()
export class WorkflowStepExecutor {
  constructor(
    private readonly resolver: WorkflowStepResolver,
    private readonly retryDelay: WorkflowRetryDelayService,

    private readonly validator: WorkflowStepResultValidator,

    @Inject(WORKFLOW_RETRY_JITTER)
    private readonly retryJitter: WorkflowRetryJitter,

    @Inject(WORKFLOW_RETRY_SCHEDULER)
    private readonly retryScheduler: WorkflowRetryScheduler,

    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
    private readonly leaseService: WorkflowLeaseService,
    private readonly persistence: WorkflowStepPersistenceService,
  ) {}

  async execute(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    signal?: WorkflowSignal,
  ): Promise<RetryExecutionResult<WorkflowStepResult>> {
    const step = workflow.steps.get(state.currentStep!);

    if (!step) {
      throw new WorkflowExecutionError(`Step '${state.currentStep}' not found`);
    }

    const handler = this.resolver.resolve(step.type);

    return this.executeStepWithTimeout(async (abortSignal) => {
      const context: WorkflowContext = {
        workflowId: state.workflowId,
        executionId: state.executionId,

        stepExecutionKey: `${state.workflowId}:${state.currentStep}:${state.historyCount + 1}`,

        workflowName: state.workflowName,
        currentStep: state.currentStep,

        data: state.data,
        signal,
        runtime: {
          abortSignal,
          isCancelled: () => abortSignal.aborted,
        },
      };

      await this.leaseService.renew(state.workflowId);

      const stopKeepAlive = this.leaseService.keepAlive(state.workflowId);

      try {
        return await this.executeWithRetry(
          workflow,
          state,
          () => handler.execute(context),
          async (currentState) => {
            const next = this.transitions.incrementStepRetry(currentState);
            return this.stateService.save(currentState, next);
          },
          abortSignal,
        ).then((execution) => {
          this.validator.validate(
            workflow,
            state.currentStep!,
            execution.result,
          );
          return execution;
        });
      } finally {
        stopKeepAlive();
      }
    }, step.metadata.timeoutMs ?? workflow.metadata.defaultStepTimeoutMs);
  }

  private isRetriable(error: unknown): boolean {
    return error instanceof WorkflowFailureError && error.retriable;
  }

  private async executeWithRetry<T>(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    operation: () => Promise<T>,
    onRetry: (state: WorkflowExecutionState) => Promise<WorkflowExecutionState>,
    signal: AbortSignal,
  ): Promise<RetryExecutionResult<T>> {
    const retry = workflow.metadata.retries;

    if (!retry) {
      return {
        result: await operation(),
        latestState: state,
      };
    }

    const maxAttempts = Math.max(1, retry.maxAttempts);

    let attempt = 0;
    let latestState = state;

    while (true) {
      try {
        const result = await operation();
        return {
          result,
          latestState,
        };
      } catch (error) {
        if (!this.isRetriable(error)) {
          throw error;
        }

        attempt++;

        if (attempt >= maxAttempts) {
          throw error;
        }

        await this.persistence.appendRetry(state.workflowId, {
          step: state.currentStep!,
          startedAt: state.stepStartedAt ?? new Date(),
          completedAt: new Date(),
          durationMs: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });

        latestState = await onRetry(latestState);

        const delay = this.retryDelay.compute(retry, attempt);

        await this.retryScheduler.wait(
          this.retryJitter.apply(delay, attempt),
          signal,
        );
      }
    }
  }

  private async executeStepWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    const controller = new AbortController();

    try {
      return await Promise.race([
        operation(controller.signal),

        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();

            reject(
              new WorkflowExecutionError(
                `Step execution timeout after ${timeoutMs}ms`,
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
