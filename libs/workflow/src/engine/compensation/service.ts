import { Injectable, Logger } from '@nestjs/common';
import { WorkflowStepResolver } from '../executor/step-resolver';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowHistoryService } from '../../persistence/history.service';
import { DEFAULT_COMPENSATION_STEP_TIMEOUT_MS } from '@/workflow/constants/workflow.constants';

@Injectable()
export class WorkflowCompensationService {
  private readonly logger = new Logger(WorkflowCompensationService.name);

  constructor(
    private readonly history: WorkflowHistoryService,
    private readonly resolver: WorkflowStepResolver,
  ) {}

  async compensate(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const strategy =
      workflow.metadata.compensation?.strategy ?? 'reverse-order';

    switch (strategy) {
      case 'reverse-order':
        return this.compensateReverseOrder(workflow, state);

      case 'custom':
        return this.compensateCustom(workflow, state);

      default:
        strategy satisfies never;
    }
  }

  private async compensateCustom(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const order = workflow.metadata.compensation?.order;

    if (!order?.length) {
      throw new Error(
        `Workflow '${workflow.metadata.name}' uses custom compensation but no compensation order was provided.`,
      );
    }

    const history = await this.history.findByWorkflowId(state.workflowId);

    const completed = history.filter(
      (execution) => execution.status === 'completed',
    );

    const executionMap = new Map(
      completed.map((execution) => [execution.step, execution]),
    );

    for (const stepId of order) {
      const execution = executionMap.get(stepId);

      if (!execution) {
        continue;
      }

      const step = workflow.steps.get(stepId);

      const compensation = step?.metadata.compensation;

      if (!compensation) {
        continue;
      }

      try {
        const handler = this.resolver.resolveCompensation(compensation.handler);

        await handler.compensate({
          workflowId: state.workflowId,
          executionId: state.executionId,
          correlationId: state.correlationId,
          workflowName: state.workflowName,
          currentStep: execution.step,
          stepExecutionKey: `${state.workflowId}:${execution.step}`,
          data: state.data,
          runtime: {
            abortSignal: AbortSignal.timeout(
              DEFAULT_COMPENSATION_STEP_TIMEOUT_MS,
            ),
            isCancelled: async () => false,
          },
        });
      } catch (error) {
        this.logger.error(
          `Compensation failed for step '${execution.step}'`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async compensateReverseOrder(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const history = await this.history.findByWorkflowId(state.workflowId);

    const completed = [...history]
      .filter((execution) => execution.status === 'completed')
      .reverse();

    for (const execution of completed) {
      const step = workflow.steps.get(execution.step);

      const compensation = step?.metadata.compensation;

      if (!compensation) {
        continue;
      }

      try {
        const handler = this.resolver.resolveCompensation(compensation.handler);

        await handler.compensate({
          workflowId: state.workflowId,
          executionId: state.executionId,
          correlationId: state.correlationId,
          workflowName: state.workflowName,
          currentStep: execution.step,
          stepExecutionKey: `${state.workflowId}:${execution.step}`,
          data: state.data,
          runtime: {
            abortSignal: AbortSignal.timeout(
              DEFAULT_COMPENSATION_STEP_TIMEOUT_MS,
            ),
            isCancelled: async () => false,
          },
        });
      } catch (error) {
        this.logger.error(
          `Compensation failed for step '${execution.step}'`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
