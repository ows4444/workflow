import { Type } from '@nestjs/common';

export interface WorkflowPersistenceMetadata {
  readonly repository: Type<unknown>;

  readonly eventStore?: Type<unknown>;

  readonly outbox?: Type<unknown>;

  readonly inbox?: Type<unknown>;

  readonly snapshotEvery?: number;
}
