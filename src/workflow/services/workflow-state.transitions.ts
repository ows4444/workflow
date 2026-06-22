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
      iteration: state.iteration + 1,
      executingStep: step,
      stepStartedAt: now,
      updatedAt: now,
    });
  }

  resume(state: WorkflowExecutionState): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'running',
      waitingForSignal: undefined,
      updatedAt: now,
    });
  }

  completeWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      status: 'completed',
      waitingForSignal: undefined,
      executingStep: undefined,
      stepStartedAt: undefined,
      completedAt: now,
      updatedAt: now,
      failedAt: undefined,
      failedStep: undefined,
      lastError: undefined,
    });
  }

  failStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    error: string,
  ): WorkflowExecutionState {
    const now = this.now();

    return this.next(state, {
      history: state.executingStep
        ? [...state.history, execution]
        : state.history,
      status: 'failed',
      executingStep: undefined,
      stepStartedAt: undefined,
      failedAt: now,
      updatedAt: now,
      failedStep: execution.step,
      lastError: error,
      failureCount: (state.failureCount ?? 0) + 1,
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
}
