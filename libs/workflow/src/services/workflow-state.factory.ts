import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

@Injectable()
export class WorkflowStateFactory {
  create(
    workflow: RegisteredWorkflow,
    initialData: Record<string, unknown>,
  ): WorkflowExecutionState {
    const now = new Date();

    return {
      workflowId: randomUUID(),
      executionId: randomUUID(),
      stateVersion: 1,
      historyCount: 0,
      workflowName: workflow.metadata.name,
      workflowVersion: workflow.metadata.version,
      status: 'running',
      iteration: 0,
      executingStep: undefined,
      currentStep: workflow.metadata.definition.start,
      createdAt: now,
      updatedAt: now,
      data: {
        ...initialData,
      },
    };
  }
}
