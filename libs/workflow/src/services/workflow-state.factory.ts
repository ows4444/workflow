import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowExecutionFactory } from '../domain/workflow-execution.factory';
import { WorkflowExecutionMapper } from '../domain/workflow-execution.mapper';

@Injectable()
export class WorkflowStateFactory {
  constructor(private readonly executionFactory: WorkflowExecutionFactory) {}

  create(
    workflow: RegisteredWorkflow,
    initialData: Record<string, unknown>,
  ): WorkflowExecutionState {
    const execution = this.executionFactory.create(workflow, initialData);

    return WorkflowExecutionMapper.toState(execution);
  }
}
