import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';

@Injectable()
export class WorkflowStateTransitions {
  private now(): Date {
    return new Date();
  }

  startStep(
    state: WorkflowExecutionState,
    step: WorkflowStepId,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      executingStep: step,
      stepStartedAt: now,
      updatedAt: now,
    });
  }

  completeStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    nextStep?: WorkflowStepId,
    waitForSignal?: WorkflowSignal,
    data?: Record<string, unknown>,
  ): WorkflowExecutionState {
    const now = this.now();
    return this.next(state, {
      history: [...state.history, execution],
      currentStep: nextStep,
      executingStep: undefined,
      stepStartedAt: undefined,
      waitingForSignal: waitForSignal,
      status: waitForSignal ? 'waiting' : 'running',
      updatedAt: now,
      data: {
        ...state.data,
        ...(data ?? {}),
      },
    });
  }

  next(
    state: WorkflowExecutionState,
    changes: Partial<WorkflowExecutionState>,
  ): WorkflowExecutionState {
    return {
      ...state,
      ...changes,
      stateVersion: state.stateVersion + 1,
    };
  }

  markRunning(state: WorkflowExecutionState): WorkflowExecutionState {
    const now = this.now();
    return this.next(state, {
      status: 'running',
      waitingForSignal: undefined,
      updatedAt: now,
    });
  }

  markWaiting(
    state: WorkflowExecutionState,
    signal: WorkflowSignal,
  ): WorkflowExecutionState {
    const now = this.now();
    return this.next(state, {
      status: 'waiting',
      waitingForSignal: signal,
      executingStep: undefined,
      stepStartedAt: undefined,
      updatedAt: now,
    });
  }

  markCompleted(state: WorkflowExecutionState): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'completed',
      waitingForSignal: undefined,
      executingStep: undefined,
      stepStartedAt: undefined,
      failedStep: undefined,
      lastError: undefined,
      completedAt: now,
      updatedAt: now,
    });
  }

  markFailed(
    state: WorkflowExecutionState,
    step: string,
    error: string,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'failed',
      waitingForSignal: undefined,
      executingStep: undefined,
      stepStartedAt: undefined,
      failedAt: now,
      updatedAt: now,
      failedStep: step,
      lastError: error,
      failureCount: (state.failureCount ?? 0) + 1,
    });
  }
}
