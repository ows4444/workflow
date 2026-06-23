import { Inject, Injectable } from '@nestjs/common';

import {
  DEFAULT_MAX_WORKFLOW_ITERATIONS,
  DEFAULT_STEP_TIMEOUT_MS,
} from '../constants/workflow.constants';
import { WorkflowExecutionResult } from '../contracts/workflow-execution-result';
import { WorkflowContext } from '../contracts/workflow-context';
import { WorkflowExecutionError } from '../errors/workflow.errors';

import { WorkflowRegistry } from './workflow.registry';
import { WorkflowStepResolver } from './workflow-step-resolver';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { type WorkflowStateStore } from '../contracts/workflow-state-store';
import {
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_STATE_STORE,
} from '../constants/workflow.tokens';
import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowRetryMetadata } from '../contracts/workflow-retry-metadata';
import { WorkflowStateValidator } from './workflow-state.validator';
import { WorkflowStateFactory } from './workflow-state.factory';
import { WorkflowFailure } from '../contracts/workflow-failure';
import { type WorkflowIdempotencyStore } from '../contracts/workflow-idempotency-store';
import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowFailureError } from '../errors/workflow-failure.error';
import { buildSignalIdempotencyKey } from './workflow-idempotency-key';

interface RetryExecutionResult<T> {
  readonly result: T;
  readonly latestState: WorkflowExecutionState;
}

@Injectable()
export class WorkflowExecutor {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly resolver: WorkflowStepResolver,
    private readonly transitions: WorkflowStateTransitions,
    private readonly history: WorkflowHistoryService,

    @Inject(WORKFLOW_STATE_STORE)
    private readonly stateStore: WorkflowStateStore,

    @Inject(WORKFLOW_IDEMPOTENCY_STORE)
    private readonly idempotencyStore: WorkflowIdempotencyStore,

    private readonly stateValidator: WorkflowStateValidator,
    private readonly stateFactory: WorkflowStateFactory,
  ) {}

  private isRetriable(error: unknown): boolean {
    return error instanceof WorkflowFailureError && error.retriable;
  }

  private serializeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private toResult(state: WorkflowExecutionState): WorkflowExecutionResult {
    return {
      workflowId: state.workflowId,
      status: state.status,
      iteration: state.iteration,
      currentStep: state.currentStep,
      data: state.data,
    };
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
        return {
          result: await operation(),
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
    }
    return Math.max(0, Math.floor(delay * (0.8 + Math.random() * 0.4)));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async persistTransition(
    previous: WorkflowExecutionState,
    next: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    next = this.transitions.bumpVersion(next);
    this.stateValidator.validate(next);

    return this.stateStore.save(previous, next);
  }

  private async run(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    signal?: WorkflowSignal,
  ): Promise<WorkflowExecutionState> {
    let pendingSignal: WorkflowSignal | undefined = signal;

    while (state.currentStep !== undefined) {
      const currentStep = state.currentStep;

      if (state.iteration > DEFAULT_MAX_WORKFLOW_ITERATIONS) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowName}' exceeded max iterations`,
        );
      }

      const step = workflow.steps.get(currentStep);

      if (!step) {
        throw new WorkflowExecutionError(`Step '${currentStep}' not found`);
      }

      const startedAt = new Date();

      const previousState = state;

      state = this.transitions.startStep(state, state.currentStep);

      state = await this.persistTransition(previousState, state);

      const handler = this.resolver.resolve(step.type);

      const execution = await this.executeStepWithTimeout(
        async (abortSignal) => {
          const context: WorkflowContext = {
            workflowId: state.workflowId,
            executionId: state.executionId,
            stepExecutionKey: `${state.workflowId}:${state.currentStep}:${state.historyCount + 1}`,
            workflowName: state.workflowName,
            currentStep: state.currentStep,
            data: state.data,
            signal: pendingSignal,
            abortSignal,
          };

          return this.executeWithRetry(
            workflow,
            state,
            () => handler.execute(context),
            async (currentState) => {
              const next = this.transitions.incrementRetry(currentState);

              return this.persistTransition(currentState, next);
            },
          );
        },
        step.metadata.timeoutMs,
      );

      state = execution.latestState;

      const result = execution.result;

      pendingSignal = undefined;
      const completedAt = new Date();

      const allowedTransitions =
        workflow.metadata.definition.transitions[currentStep] ?? [];

      if (result.nextStep && !allowedTransitions.includes(result.nextStep)) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowName}' cannot transition from '${state.currentStep}' to '${result.nextStep}'`,
        );
      }

      const previousCompletedState = state;

      const stepExecution = {
        step: step.metadata.step,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: 'completed' as const,
      };

      await this.history.append(state.workflowId, stepExecution);

      state = this.transitions.completeStep(
        state,
        stepExecution,
        result.nextStep,
        result.waitForSignal,
        result.data,
      );

      state = await this.persistTransition(previousCompletedState, state);

      if (result.waitForSignal) {
        break;
      }
    }

    return state;
  }

  private toFailure(error: unknown): WorkflowFailure {
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
      message: this.serializeError(error),
      retriable: false,
    };
  }

  async execute(
    workflowName: string,
    initialData: Record<string, unknown> = {},
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.registry.getLatest(workflowName);

    let state = this.stateFactory.create(workflow, initialData);
    await this.stateStore.insert(state);

    try {
      state = await this.run(workflow, state);
    } catch (error) {
      const failedAt = new Date();
      const failedStep = state.currentStep ?? state.executingStep;

      const previousState = state;

      if (failedStep) {
        await this.history.append(state.workflowId, {
          step: failedStep,
          startedAt: state.stepStartedAt ?? failedAt,
          completedAt: failedAt,
          durationMs:
            failedAt.getTime() - (state.stepStartedAt ?? failedAt).getTime(),
          status: 'failed',
          error: this.serializeError(error),
        });

        const failedState = this.transitions.failStep(
          state,
          {
            step: failedStep,
            startedAt: state.stepStartedAt ?? failedAt,
            completedAt: failedAt,
            status: 'failed',
            error: this.serializeError(error),
          },
          this.toFailure(error),
        );
        await this.persistTransition(previousState, failedState);
      }

      throw error;
    }

    if (state.status !== 'waiting') {
      const previousState = state;
      state = this.transitions.completeWorkflow(state);
      state = await this.persistTransition(previousState, state);
    }

    return this.toResult(state);
  }

  async signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    const idempotencyKey = buildSignalIdempotencyKey(
      workflowId,
      signal.signalId,
    );

    if (await this.idempotencyStore.exists(idempotencyKey)) {
      const existing = await this.stateStore.load(workflowId);

      if (!existing) {
        throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
      }

      return this.toResult(existing);
    }
    let state = await this.stateStore.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }
    this.stateValidator.validate(state);

    if (state.waitingForSignal?.name !== signal.name) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is not waiting for '${signal.name}'`,
      );
    }

    const nextState = this.transitions.resumeFromSignal(state);

    state = await this.persistTransition(state, nextState);

    const workflow = this.registry.get(
      nextState.workflowName,
      nextState.workflowVersion,
    );

    let finalState: WorkflowExecutionState | undefined;

    try {
      finalState = await this.run(workflow, state, signal);
    } catch (error) {
      if (state.executingStep) {
        const failedAt = new Date();

        await this.history.append(state.workflowId, {
          step: state.executingStep,
          startedAt: state.stepStartedAt ?? failedAt,
          completedAt: failedAt,
          durationMs:
            failedAt.getTime() - (state.stepStartedAt ?? failedAt).getTime(),
          status: 'failed',
          error: this.serializeError(error),
        });
      }

      const failedState = this.transitions.failWorkflow(
        finalState ?? state,
        this.toFailure(error),
      );

      await this.persistTransition(finalState ?? state, failedState);
      throw error;
    }

    if (!finalState.waitingForSignal) {
      const previousState = finalState;
      finalState = await this.persistTransition(
        previousState,
        this.transitions.completeWorkflow(finalState),
      );
    }

    await this.idempotencyStore.markCompleted(
      idempotencyKey,
      finalState.workflowId,
    );

    return this.toResult(finalState);
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
            controller.abort(
              new WorkflowExecutionError(
                `Step execution timeout after ${timeoutMs}ms`,
              ),
            );

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
