import { Type } from '@nestjs/common';
import { WorkflowHook } from '../contracts/workflow-hook';

export interface WorkflowHookMetadata {
  readonly onStart?: Type<WorkflowHook>;

  readonly onComplete?: Type<WorkflowHook>;

  readonly onFailure?: Type<WorkflowHook>;

  readonly onCancel?: Type<WorkflowHook>;

  readonly onExpire?: Type<WorkflowHook>;

  readonly onSignal?: Type<WorkflowHook>;
}
