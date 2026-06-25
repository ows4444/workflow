import { Type } from '@nestjs/common';

import { WorkflowStepHandler } from './workflow-step-handler';
import { WorkflowStepId } from './workflow-step-id';
import { WorkflowMetadata } from '../metadata/workflow-metadata';
import { WorkflowStepMetadata } from '../metadata/workflow-step-metadata';
import { WorkflowCompensationHandler } from './workflow-compensation-handler';

export interface RegisteredWorkflowStep {
  readonly metadata: WorkflowStepMetadata;

  readonly type: Type<WorkflowStepHandler>;
}

export interface RegisteredWorkflow {
  readonly metadata: WorkflowMetadata;

  readonly workflowType: Type<unknown>;

  readonly steps: ReadonlyMap<WorkflowStepId, RegisteredWorkflowStep>;

  readonly transitions: ReadonlyMap<
    WorkflowStepId,
    ReadonlySet<WorkflowStepId>
  >;

  readonly compensation?: Type<WorkflowCompensationHandler>;
}
