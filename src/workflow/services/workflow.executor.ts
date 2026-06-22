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
import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';
import { randomUUID } from 'crypto';
import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowRetryMetadata } from '../contracts/workflow-retry-metadata';

@Injectable()
export class WorkflowExecutor {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly resolver: WorkflowStepResolver,
    private readonly transitions: WorkflowStateTransitions,
    @Inject(WORKFLOW_STATE_STORE)
    private readonly stateStore: WorkflowStateStore,
  ) {}

  private serializeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private toResult(state: WorkflowExecutionState): WorkflowExecutionResult {
    return {
      workflowId: state.workflowId,
      status: state.status as WorkflowExecutionResult['status'],
      iteration: state.iteration,
      currentStep: state.currentStep ?? undefined,
      data: state.data,
    };
  }

  private async executeWithRetry<T>(
    workflow: RegisteredWorkflow,
    operation: () => Promise<T>,
  ): Promise<T> {
    const retry = workflow.metadata.retries;

    if (!retry) {
      return operation();
    }

    const maxAttempts = Math.max(1, retry.maxAttempts);
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt++;

        if (attempt >= maxAttempts) {
          throw error;
        }

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
    return Math.floor(delay * (0.8 + Math.random() * 0.4));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async persistTransition(
    previousState: WorkflowExecutionState,
    nextState: WorkflowExecutionState,
  ): Promise<void> {
    await this.stateStore.save(previousState, nextState);
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

      await this.persistTransition(previousState, state);

      const handler = this.resolver.resolve(step.type);

      const context: WorkflowContext = {
        workflowId: state.workflowId,
        executionId: state.executionId,
        stepExecutionKey: `${state.workflowId}:${state.currentStep}:${state.history.length + 1}`,
        workflowName: state.workflowName,
        currentStep: state.currentStep,
        data: state.data,
        signal: pendingSignal,
      };

      const result = await this.executeStepWithTimeout(
        () => this.executeWithRetry(workflow, () => handler.execute(context)),
        step.metadata.timeoutMs,
      );
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
      state = this.transitions.completeStep(
        state,
        {
          step: step.metadata.step,
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          status: 'completed',
        },
        result.nextStep,
        result.waitForSignal,
        result.data,
      );

      await this.persistTransition(previousCompletedState, state);

      if (result.waitForSignal) {
        break;
      }
    }

    return state;
  }

  async execute(
    workflowName: string,
    initialData: Record<string, unknown> = {},
  ): Promise<WorkflowExecutionResult> {
    const workflowId = randomUUID();
    const workflow = this.registry.getLatest(workflowName);

    const now = new Date();

    let state: WorkflowExecutionState = {
      workflowId,
      executionId: randomUUID(),
      stateVersion: 1,
      history: [],
      workflowName,
      status: 'running',
      lastError: undefined,
      failedAt: undefined,
      createdAt: now,
      updatedAt: now,
      currentStep: workflow.metadata.definition.start,
      iteration: 0,
      workflowVersion: workflow.metadata.version,
      data: {
        ...initialData,
      },
    };

    await this.stateStore.insert(state);

    try {
      state = await this.run(workflow, state);
    } catch (error) {
      const failedAt = new Date();
      const failedStep = state.currentStep;

      const previousFailedState = state;

      if (failedStep) {
        state = this.transitions.failStep(
          state,
          {
            step: failedStep,
            startedAt: state.stepStartedAt ?? failedAt,
            completedAt: failedAt,
            status: 'failed',
            error: this.serializeError(error),
          },
          this.serializeError(error),
        );

        await this.persistTransition(previousFailedState, state);
      }

      throw error;
    }

    if (state.status !== 'waiting') {
      const previousState = state;
      state = this.transitions.completeWorkflow(state);
      await this.persistTransition(previousState, state);
    }

    return this.toResult(state);
  }

  async resume(workflowId: string): Promise<WorkflowExecutionResult> {
    const state = await this.stateStore.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.executingStep) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' stopped while executing step '${state.executingStep}'`,
      );
    }

    if (state.status === 'completed') {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is already completed`,
      );
    }

    if (state.status === 'failed') {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' is failed`);
    }

    if (state.status === 'running') {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is already running`,
      );
    }

    if (state.status === 'waiting' && state.waitingForSignal) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is waiting for signal '${state.waitingForSignal.name}'`,
      );
    }

    const workflow = this.registry.get(
      state.workflowName,
      state.workflowVersion,
    );
    const previousState = state;

    const resumedState = this.transitions.resume(state);

    await this.persistTransition(previousState, resumedState);

    let finalState: WorkflowExecutionState;

    try {
      finalState = await this.run(workflow, resumedState);
    } catch (error) {
      const failedAt = new Date();
      const failedState = this.transitions.next(resumedState, {
        recoveryReason: 'process-crash',
        status: 'failed',
        requiresRecovery: true,
        failedAt,
        updatedAt: failedAt,
        failedStep: resumedState.currentStep,
        failureCount: (resumedState.failureCount ?? 0) + 1,
        lastError: this.serializeError(error),
      });

      await this.stateStore.save(resumedState, failedState);

      throw error;
    }

    const isWaiting = !!finalState.waitingForSignal;

    const savedFinal = isWaiting
      ? finalState
      : this.transitions.completeWorkflow(finalState);

    await this.stateStore.save(finalState, savedFinal);

    return this.toResult(savedFinal);
  }

  async signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    const state = await this.stateStore.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.waitingForSignal?.name !== signal.name) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is not waiting for '${signal.name}'`,
      );
    }

    const resumedState = this.transitions.resume(state);

    await this.stateStore.save(state, resumedState);

    const workflow = this.registry.get(
      resumedState.workflowName,
      resumedState.workflowVersion,
    );

    let finalState: WorkflowExecutionState;

    try {
      finalState = await this.run(workflow, resumedState, signal);
    } catch (error) {
      const failedAt = new Date();
      const failedState = this.transitions.next(resumedState, {
        status: 'failed',
        failedAt,
        updatedAt: failedAt,
        failedStep: resumedState.currentStep,
        failureCount: (resumedState.failureCount ?? 0) + 1,
        lastError: this.serializeError(error),
      });

      await this.stateStore.save(resumedState, failedState);
      throw error;
    }

    const isWaiting = !!finalState.waitingForSignal;

    const savedFinal = isWaiting
      ? finalState
      : this.transitions.completeWorkflow(finalState);

    await this.stateStore.save(finalState, savedFinal);

    return this.toResult(savedFinal);
  }

  private async executeStepWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  ): Promise<T> {
    let timeout: NodeJS.Timeout = setTimeout(() => {}, 0);

    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new WorkflowExecutionError(
                  `Step execution timeout after ${timeoutMs}ms`,
                ),
              ),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
