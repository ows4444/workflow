import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

@Injectable()
export class WorkflowStateFactory {
  constructor() {}

  create(
    workflow: RegisteredWorkflow,
    initialData: Record<string, unknown>,
  ): WorkflowExecutionState {
    void workflow;
    void initialData;

    return {} as WorkflowExecutionState;
  }
}
