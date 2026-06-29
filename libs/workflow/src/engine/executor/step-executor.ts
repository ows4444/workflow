import { Inject, Injectable } from '@nestjs/common';
import { WorkflowRetryDelayService } from '../retry/delay.service';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowStepResultValidator } from '../validation/step-result.validator';
import { WorkflowStepPersistenceService } from './step-persistence';
import { WorkflowStepResolver } from './step-resolver';
import { DEFAULT_STEP_TIMEOUT_MS } from '../../constants/workflow.constants';
import {
  WORKFLOW_RETRY_JITTER,
  WORKFLOW_RETRY_SCHEDULER,
} from '../../constants/workflow.tokens';
import { WorkflowFailureError } from '../../errors';
import { WorkflowExecutionError } from '../../errors/workflow.errors';
import { WorkflowLeaseService } from '../../infrastructure/lease/lease.service';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { type WorkflowRetryJitter } from '../../models/workflow-retry-jitter';
import { type WorkflowRetryScheduler } from '../../models/workflow-retry-scheduler';
import { WorkflowSignal } from '../../models/workflow-signal';
import { WorkflowStepResult } from '../../models/workflow-step-result';
import { WorkflowContext } from '../../types/workflow-context';

interface RetryExecutionResult<T> {
  readonly result: T;
  readonly latestState: WorkflowExecutionState;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);

    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }

  return value;
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
        correlationId: state.correlationId,

        stepExecutionKey: `${state.workflowId}:${state.currentStep}:${state.historyCount + 1}`,

        workflowName: state.workflowName,
        currentStep: state.currentStep,

        data: deepFreeze(structuredClone(state.data)),
        signal,
        runtime: {
          abortSignal,
          isCancelled: async () => {
            if (abortSignal.aborted) {
              return true;
            }

            return this.stateService.isCancelled(state.workflowId);
          },
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
    const execution = operation(controller.signal);

    execution.catch(() => {
      // The execution may outlive the workflow timeout if user code
      // ignores AbortSignal. Consume the rejection so it does not
      // become an unhandled promise rejection.
    });

    try {
      return await Promise.race([
        execution,

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
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
