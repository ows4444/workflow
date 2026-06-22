import { Type } from '@nestjs/common';

import { WorkflowMetadata } from './workflow-metadata';
import { WorkflowStepMetadata } from './workflow-step-metadata';
import { WorkflowStepHandler } from './workflow-step-handler';

export interface RegisteredWorkflowStep {
  readonly metadata: WorkflowStepMetadata;

  readonly type: Type<WorkflowStepHandler>;
}

export interface RegisteredWorkflow {
  readonly metadata: WorkflowMetadata;

  readonly steps: Map<string, RegisteredWorkflowStep>;
}
