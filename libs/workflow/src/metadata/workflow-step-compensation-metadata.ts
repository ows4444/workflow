import { Type } from '@nestjs/common';

import { WorkflowCompensationHandler } from '../contracts/workflow-compensation-handler';

export interface WorkflowStepCompensationMetadata {
  readonly handler: Type<WorkflowCompensationHandler>;
}
