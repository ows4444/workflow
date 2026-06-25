import { Injectable } from '@nestjs/common';

import { DEFAULT_MAX_WORKFLOW_ITERATIONS } from '../constants/workflow.constants';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowSignal } from '../contracts/workflow-signal';

import { WorkflowExecutionError } from '../errors/workflow.errors';

import { WorkflowStateService } from './workflow-state.service';
import { WorkflowStepExecutor } from './workflow-step.executor';
import { WorkflowStepPersistenceService } from './workflow-step-persistence.service';
import { WorkflowTransitionValidator } from './workflow-transition.validator';

@Injectable()
export class WorkflowRunner {
  constructor(
    private readonly stepExecutor: WorkflowStepExecutor,
    private readonly stateService: WorkflowStateService,
    private readonly stepPersistence: WorkflowStepPersistenceService,
    private readonly transitionValidator: WorkflowTransitionValidator,
  ) {}

  async run(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    signal?: WorkflowSignal,
  ): Promise<WorkflowExecutionState> {
    let pendingSignal = signal;

    while (state.currentStep) {
      if (state.iteration >= DEFAULT_MAX_WORKFLOW_ITERATIONS) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowName}' exceeded max iterations`,
        );
      }

      const currentStep = state.currentStep;

      const step = workflow.steps.get(currentStep);

      if (!step) {
        throw new WorkflowExecutionError(`Step '${currentStep}' not found`);
      }

      const startedAt = new Date();

      const previous = state;

      state = { ...state, currentStep };

      state = await this.stateService.save(previous, state);

      const execution = await this.stepExecutor.execute(
        workflow,
        state,
        pendingSignal,
      );

      pendingSignal = undefined;

      state = execution.latestState;

      this.transitionValidator.validate(
        workflow,
        currentStep,
        execution.result.nextStep,
      );

      const completedAt = new Date();

      state = await this.stepPersistence.completeStep(
        state,
        {
          step: currentStep,
          startedAt,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          status: 'completed',
        },
        execution.result,
      );

      if (execution.result.waitForSignal) {
        break;
      }
    }

    return state;
  }
}
