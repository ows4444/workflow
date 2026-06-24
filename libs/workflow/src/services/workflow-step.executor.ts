import { Injectable } from '@nestjs/common';

import { DEFAULT_STEP_TIMEOUT_MS } from '../constants/workflow.constants';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowContext } from '../contracts/workflow-context';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepResult } from '../contracts/workflow-step-result';

import { WorkflowRetryMetadata } from '../metadata/workflow-retry-metadata';

import { WorkflowStepResolver } from './workflow-step-resolver';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';

import { WorkflowFailureError } from '../errors/workflow-failure.error';
import { WorkflowExecutionError } from '../errors/workflow.errors';

interface RetryExecutionResult<T> {
  readonly result: T;
  readonly latestState: WorkflowExecutionState;
}

@Injectable()
export class WorkflowStepExecutor {
  constructor(
    private readonly resolver: WorkflowStepResolver,
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
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
        abortSignal,
      };

      return this.executeWithRetry(
        workflow,
        state,
        () => handler.execute(context),
        async (currentState) => {
          const next = this.transitions.incrementRetry(currentState);

          return this.stateService.save(currentState, next);
        },
      );
    }, step.metadata.timeoutMs);
  }

  private isRetriable(error: unknown): boolean {
    return error instanceof WorkflowFailureError && error.retriable;
  }

  private async executeWithRetry<T>(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    operation: () => Promise<T>,
    onRetry: (state: WorkflowExecutionState) => Promise<WorkflowExecutionState>,
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

    while (true) {
      try {
        const result = await operation();
        return {
          result,
          latestState: state,
        };
      } catch (error) {
        if (!this.isRetriable(error)) {
          throw error;
        }

        attempt++;

        if (attempt >= maxAttempts) {
          throw error;
        }

        state = await onRetry(state);

        await this.sleep(this.computeDelay(retry, attempt));
      }
    }
  }

  private computeDelay(retry: WorkflowRetryMetadata, attempt: number): number {
    let delay: number;

    switch (retry.strategy) {
      case 'fixed':
        delay = retry.delayMs ?? 1000;
        break;

      case 'linear':
        delay = (retry.delayMs ?? 1000) * attempt;
        break;

      case 'exponential':
        delay = Math.min(
          (retry.delayMs ?? 1000) * 2 ** (attempt - 1),
          retry.maxDelayMs ?? Number.MAX_SAFE_INTEGER,
        );
        break;

      default:
        retry.strategy satisfies never;
        delay = retry.delayMs ?? 1000;
    }

    return Math.max(0, Math.floor(delay * (0.8 + Math.random() * 0.4)));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
