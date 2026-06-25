import { Injectable } from '@nestjs/common';

import { DEFAULT_MAX_WORKFLOW_ITERATIONS } from '../../constants/workflow.constants';
import {
  WorkflowConcurrencyError,
  WorkflowExecutionError,
} from '@/workflow/errors/workflow.errors';
import { RegisteredWorkflow } from '@/workflow/models/registered-workflow';
import { WorkflowExecutionState } from '@/workflow/models/workflow-execution-state';
import { WorkflowSignal } from '@/workflow/models/workflow-signal';
import { WorkflowLogger } from '@/workflow/observability/logger';
import { WorkflowStateService } from '../state/service';
import { WorkflowTransitionValidator } from '../state/transition-validator';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowStepExecutor } from './step-executor';
import { WorkflowStepPersistenceService } from './step-persistence';

@Injectable()
export class WorkflowRunner {
  constructor(
    private readonly stepExecutor: WorkflowStepExecutor,
    private readonly stateService: WorkflowStateService,
    private readonly stepPersistence: WorkflowStepPersistenceService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly transitionValidator: WorkflowTransitionValidator,
    private readonly logger: WorkflowLogger,
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

      if (step.metadata.deprecated) {
        this.logger.deprecatedStep(
          workflow.metadata.name,
          currentStep,
          step.metadata.replacedBy,
        );
      }

      if (state.executingStep !== currentStep) {
        const previous = state;

        state = this.transitions.startStep(state, currentStep);

        try {
          state = await this.stateService.save(previous, state);
        } catch (error) {
          if (!(error instanceof WorkflowConcurrencyError)) {
            throw error;
          }

          state = await this.stateService.reload(previous);

          continue;
        }
      }
      const startedAt = new Date();
      this.logger.stepStarted(state);
      const execution = await this.stepExecutor.execute(
        workflow,
        state,
        pendingSignal,
      );

      pendingSignal = undefined;

      const latest = await this.stateService.load(state.workflowId);

      if (!latest) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowId}' no longer exists`,
        );
      }

      if (latest.stateVersion !== state.stateVersion) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowId}' changed while step '${currentStep}' was executing`,
        );
      }

      if (latest.status !== 'running') {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowId}' is no longer running`,
        );
      }

      this.transitionValidator.validate(
        workflow,
        currentStep,
        execution.result.nextStep,
      );
      state = execution.latestState;

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
      this.logger.stepCompleted(state);

      if (execution.result.waitForSignal) {
        break;
      }
    }

    return state;
  }
}
