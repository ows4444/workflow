import { Injectable, Logger } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowStepResolver } from './workflow-step-resolver';

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
        throw new Error(
          `Compensation strategy '${strategy}' is not implemented.`,
        );

      default:
        strategy satisfies never;
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
          workflowName: state.workflowName,
          currentStep: execution.step,
          stepExecutionKey: `${state.workflowId}:${execution.step}`,
          data: state.data,
          runtime: {
            abortSignal: AbortSignal.timeout(Number.MAX_SAFE_INTEGER),
            isCancelled: () => false,
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
