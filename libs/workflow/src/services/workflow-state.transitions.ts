import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';
import { WorkflowFailure } from '../contracts/workflow-failure';

import { WorkflowExecutionMapper } from '../domain/workflow-execution.mapper';

@Injectable()
export class WorkflowStateTransitions {
  bumpVersion(state: WorkflowExecutionState): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).bumpVersion(),
    );
  }

  startStep(
    state: WorkflowExecutionState,
    step: WorkflowStepId,
  ): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).startStep(step),
    );
  }

  incrementRetry(state: WorkflowExecutionState): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).incrementRetry(),
    );
  }

  completeWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).complete(),
    );
  }

  failStep(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).fail(failure, execution.step),
    );
  }

  failWorkflow(
    state: WorkflowExecutionState,
    failure: WorkflowFailure,
  ): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).fail(failure, state.currentStep),
    );
  }

  resumeFromSignal(state: WorkflowExecutionState): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).resume(),
    );
  }

  markRecoverable(
    state: WorkflowExecutionState,
    reason: WorkflowExecutionState['recoveryReason'],
  ): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).markRecoverable(reason),
    );
  }

  cancelWorkflow(state: WorkflowExecutionState): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).cancel(),
    );
  }

  completeStep(
    state: WorkflowExecutionState,
    _execution: WorkflowStepExecution,
    nextStep?: WorkflowStepId,
    waitForSignal?: WorkflowSignal,
    data?: object,
  ): WorkflowExecutionState {
    return WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).completeStep(
        nextStep,
        waitForSignal,
        data,
      ),
    );
  }
}
