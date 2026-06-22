import { Type } from '@nestjs/common';

export interface WorkflowHookMetadata {
  readonly onStart?: Type<unknown>;

  readonly onComplete?: Type<unknown>;

  readonly onFailure?: Type<unknown>;

  readonly onCancel?: Type<unknown>;

  readonly onExpire?: Type<unknown>;

  readonly onSignal?: Type<unknown>;
}
