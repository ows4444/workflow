import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';

@Injectable()
export class WorkflowStateFactory {
  create(
    workflow: RegisteredWorkflow,
    initialData: Record<string, unknown>,
  ): WorkflowExecutionState {
    const now = new Date();
    const startStep = workflow.metadata.definition.start;

    return {
      executionId: randomUUID(),
      workflowId: randomUUID(),

      workflowName: workflow.metadata.name,
      workflowVersion: workflow.metadata.version,

      status: 'running',

      currentStep: startStep,
      executingStep: undefined,
      stepStartedAt: undefined,

      iteration: 0,
      historyCount: 0,

      stepRetryCount: 0,
      failureCount: 0,

      stateVersion: 0,

      createdAt: now,
      updatedAt: now,

      data: { ...initialData },
    };
  }
}
