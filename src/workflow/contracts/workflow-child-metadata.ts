import { Type } from '@nestjs/common';

type WorkflowClass = Type<unknown>;
export interface WorkflowChildMetadata {
  readonly workflow: WorkflowClass;

  readonly failurePolicy:
    | 'fail-parent'
    | 'ignore'
    | 'retry-child'
    | 'compensate-parent';

  readonly cancellationPolicy: 'propagate' | 'detach';
}
