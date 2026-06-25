import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';
import { WorkflowFailure } from '../contracts/workflow-failure';

@Injectable()
export class WorkflowStateTransitions {
  private bumpVersion(state: WorkflowExecutionState): WorkflowExecutionState {
    return {
      ...state,
      stateVersion: state.stateVersion + 1,
      updatedAt: new Date(),
    };
  }

  startStep(
    state: WorkflowExecutionState,
    step: WorkflowStepId,
  ): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      currentStep: step,
      executingStep: step,
      stepStartedAt: new Date(),
      requiresRecovery: false,
    });
  }
  incrementRetry(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      retryCount: (state.retryCount ?? 0) + 1,
    });
  }
  completeWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      status: 'completed',
      currentStep: undefined,
      executingStep: undefined,
      waitingForSignal: undefined,
      resumeStep: undefined,
      completedAt: new Date(),
      stepStartedAt: undefined,
      requiresRecovery: false,
    });
  }
  failStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      executingStep: undefined,
      stepStartedAt: undefined,
      failedStep: execution.step,
      lastFailure: failure,
    });
  }
  failWorkflow(
    state: WorkflowExecutionState,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      status: 'failed',
      executingStep: undefined,
      waitingForSignal: undefined,
      resumeStep: undefined,
      stepStartedAt: undefined,
      failedStep: state.executingStep ?? state.currentStep,
      failedAt: new Date(),
      lastFailure: failure,
      failureCount: (state.failureCount ?? 0) + 1,
      requiresRecovery: false,
    });
  }
  resumeFromSignal(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      status: 'running',
      currentStep: state.resumeStep,
      resumeStep: undefined,
      waitingForSignal: undefined,
    });
  }
  markRecoverable(
    state: WorkflowExecutionState,
    reason: WorkflowExecutionState['recoveryReason'],
  ): WorkflowExecutionState {
    return this.bumpVersion({
      ...state,
      requiresRecovery: true,
      recoveryReason: reason,
      recoveryAttempts: (state.recoveryAttempts ?? 0) + 1,
      lastRecoveryAt: new Date(),
    });
  }
  completeStep(
    state: WorkflowExecutionState,
    _execution: WorkflowStepExecution,
    nextStep?: WorkflowStepId,
    waitForSignal?: WorkflowSignal,
    data?: object,
  ): WorkflowExecutionState {
    const mergedData =
      data === undefined
        ? state.data
        : {
            ...state.data,
            ...data,
          };

    if (waitForSignal) {
      return this.bumpVersion({
        ...state,
        status: 'waiting',
        data: mergedData,
        executingStep: undefined,
        stepStartedAt: undefined,
        waitingForSignal: waitForSignal,
        resumeStep: nextStep,
      });
    }

    return this.bumpVersion({
      ...state,
      data: mergedData,
      executingStep: undefined,
      stepStartedAt: undefined,
      waitingForSignal: undefined,
      resumeStep: undefined,
      currentStep: nextStep,
      historyCount: state.historyCount + 1,
      iteration: state.iteration + 1,
    });
  }
}
