import { Injectable } from '@nestjs/common';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowFailure } from '../../models/workflow-failure';
import { WorkflowSignal } from '../../models/workflow-signal';
import { WorkflowStepExecution } from '../../models/workflow-step-execution';
import { WorkflowStepId } from '../../models/workflow-step-id';

@Injectable()
export class WorkflowStateTransitions {
  private touch(state: WorkflowExecutionState): WorkflowExecutionState {
    return {
      ...state,
      updatedAt: new Date(),
    };
  }

  startStep(
    state: WorkflowExecutionState,
    step: WorkflowStepId,
    startedAt = new Date(),
  ): WorkflowExecutionState {
    return this.touch({
      ...state,
      currentStep: step,
      executingStep: step,
      stepStartedAt: startedAt,
      requiresRecovery: false,
      retryAt: undefined,
    });
  }

  incrementStepRetry(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.touch({
      ...state,
      stepRetryCount: (state.stepRetryCount ?? 0) + 1,
    });
  }

  completeWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.touch({
      ...state,
      stepRetryCount: 0,
      status: 'completed',
      currentStep: undefined,
      executingStep: undefined,
      waitingForSignal: undefined,
      waitingSince: undefined,
      resumeStep: undefined,
      completedAt: new Date(),
      stepStartedAt: undefined,
      requiresRecovery: false,
    });
  }

  cancelWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.touch({
      ...state,
      status: 'cancelled',
      currentStep: undefined,
      executingStep: undefined,
      waitingForSignal: undefined,
      waitingSince: undefined,
      resumeStep: undefined,
      stepStartedAt: undefined,
      requiresRecovery: false,
    });
  }

  failStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    return this.touch({
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
    return this.touch({
      ...state,
      status: 'failed',
      stepRetryCount: 0,
      executingStep: undefined,
      waitingForSignal: undefined,
      waitingSince: undefined,
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
    return this.touch({
      ...state,
      status: 'running',
      currentStep: state.resumeStep,
      resumeStep: undefined,
      waitingForSignal: undefined,
      waitingSince: undefined,
    });
  }

  markRecoverable(
    state: WorkflowExecutionState,
    reason: WorkflowExecutionState['recoveryReason'],
    retryAt?: Date,
  ): WorkflowExecutionState {
    return this.touch({
      ...state,
      stepRetryCount: 0,
      requiresRecovery: true,
      recoveryReason: reason,
      recoveryAttempts: (state.recoveryAttempts ?? 0) + 1,
      retryAt,
      lastRecoveryAt: new Date(),
    });
  }

  clearRecovery(state: WorkflowExecutionState): WorkflowExecutionState {
    return this.touch({
      ...state,
      requiresRecovery: false,
      recoveryReason: undefined,
      retryAt: undefined,
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
      return this.touch({
        ...state,
        stepRetryCount: 0,
        status: 'waiting',
        data: mergedData,
        executingStep: undefined,
        stepStartedAt: undefined,
        waitingForSignal: waitForSignal,
        waitingSince: new Date(),
        resumeStep: nextStep,
        historyCount: state.historyCount + 1,
        iteration: state.iteration + 1,
      });
    }

    return this.touch({
      ...state,
      stepRetryCount: 0,
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
