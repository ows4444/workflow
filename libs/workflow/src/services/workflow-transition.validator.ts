import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowTransitionValidator {
  validate(
    workflow: RegisteredWorkflow,
    current: WorkflowStepId,
    next?: WorkflowStepId,
  ): void {
    if (!next) {
      return;
    }

    const allowed = workflow.transitions.get(current);

    if (!allowed?.has(next)) {
      throw new WorkflowExecutionError(
        `Workflow '${workflow.metadata.name}' cannot transition from '${current}' to '${next}'`,
      );
    }
  }
}
