import { Injectable } from '@nestjs/common';

import { DEFAULT_MAX_WORKFLOW_ITERATIONS } from '../../constants/workflow.constants';
import { WorkflowStateService } from '../state/service';
import { WorkflowTransitionValidator } from '../state/transition-validator';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowStepExecutor } from './step-executor';
import { WorkflowStepPersistenceService } from './step-persistence';
import {
  WorkflowConcurrencyError,
  WorkflowExecutionError,
} from '../../errors/workflow.errors';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowSignal } from '../../models/workflow-signal';
import { WorkflowLogger } from '../../observability/logger';

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

      await this.stepPersistence.startStep(state.workflowId, {
        step: currentStep,
        startedAt,
        status: 'started',
      });

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
        if (latest.status === 'cancelled') {
          return latest;
        }

        throw new WorkflowExecutionError(
          `Workflow '${state.workflowId}' changed while step '${currentStep}' was executing`,
        );
      }

      if (latest.status !== 'running') {
        if (latest.status === 'cancelled') {
          return latest;
        }

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

      const stepExecution = {
        step: currentStep,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: 'completed' as const,
      };

      state = await this.stepPersistence.completeStep(
        workflow,
        state,
        stepExecution,
        execution.result,
      );

      this.logger.stepCompleted(state, stepExecution);

      if (execution.result.waitForSignal) {
        break;
      }
    }

    return state;
  }
}
