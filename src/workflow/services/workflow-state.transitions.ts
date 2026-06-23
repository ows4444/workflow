import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';
import { WorkflowFailure } from '../contracts/workflow-failure';
import { WorkflowStateUpdate } from '../contracts/workflow-state-update';

@Injectable()
export class WorkflowStateTransitions {
  private now(): Date {
    return new Date();
  }

  bumpVersion(state: WorkflowExecutionState): WorkflowExecutionState {
    return {
      ...state,
      stateVersion: state.stateVersion + 1,
    };
  }

  startStep(
    state: WorkflowExecutionState,
    step: WorkflowStepId,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      iteration: state.iteration + 1,
      executingStep: step,
      retryCount: 0,
      stepStartedAt: now,
      updatedAt: now,
    });
  }

  incrementRetry(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.next(state, {
      retryCount: (state.retryCount ?? 0) + 1,
      updatedAt: this.now(),
    });
  }

  completeWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'completed',
      currentStep: undefined,
      executingStep: undefined,
      waitingForSignal: undefined,
      stepStartedAt: undefined,
      completedAt: now,
      updatedAt: now,
      failedAt: undefined,
      failedStep: undefined,
      lastFailure: undefined,
    });
  }

  failStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      historyCount: state.historyCount + 1,
      status: 'failed',
      retryCount: 0,
      executingStep: undefined,
      stepStartedAt: undefined,
      failedAt: now,
      updatedAt: now,
      failedStep: execution.step,
      lastFailure: failure,
      failureCount: (state.failureCount ?? 0) + 1,
    });
  }

  failWorkflow(
    state: WorkflowExecutionState,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'failed',
      retryCount: 0,
      failedAt: now,
      updatedAt: now,
      failedStep: state.currentStep,
      lastFailure: failure,
      failureCount: (state.failureCount ?? 0) + 1,
      waitingForSignal: undefined,
      executingStep: undefined,
      stepStartedAt: undefined,
    });
  }

  resumeFromSignal(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.next(state, {
      status: 'running',
      waitingForSignal: undefined,
      updatedAt: this.now(),
    });
  }

  markRecoverable(
    state: WorkflowExecutionState,
    reason: WorkflowExecutionState['recoveryReason'],
  ): WorkflowExecutionState {
    return this.next(state, {
      requiresRecovery: true,
      recoveryReason: reason,
      updatedAt: this.now(),
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
      historyCount: state.historyCount + 1,
      retryCount: 0,
      executingStep: undefined,
      currentStep: nextStep,
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
    changes: WorkflowStateUpdate,
  ): WorkflowExecutionState {
    return {
      ...state,
      ...changes,
    };
  }
}
