import { Provider, Type } from '@nestjs/common';
import { WorkflowDefinitionMetadata } from './workflow-definition-metadata';
import { WorkflowRetryMetadata } from './workflow-retry-metadata';
import { WorkflowHookMetadata } from './workflow-hook-metadata';
import { WorkflowAutoResumeMetadata } from './workflow-auto-resume-metadata';
import { WorkflowRetentionMetadata } from './workflow-retention-metadata';
// import { WorkflowPersistenceMetadata } from './workflow-persistence-metadata';
// import { WorkflowRetentionMetadata } from './workflow-retention-metadata';
// import { WorkflowSignalMetadata } from './workflow-signal-metadata';
// import { WorkflowCompensationMetadata } from './workflow-compensation-metadata';
// import { WorkflowChildMetadata } from './workflow-child-metadata';
// import { WorkflowHookMetadata } from './workflow-hook-metadata';
// import { WorkflowObservabilityMetadata } from './workflow-observability-metadata';

export interface WorkflowMetadata {
  readonly name: string;

  readonly version: number;

  readonly description?: string;

  readonly imports?: Type<unknown>[];

  readonly providers?: Provider[];

  readonly exports?: Provider[];

  readonly definition: WorkflowDefinitionMetadata;

  readonly retries?: WorkflowRetryMetadata;

  readonly hooks?: WorkflowHookMetadata;

  readonly autoResume?: WorkflowAutoResumeMetadata;

  readonly retention?: WorkflowRetentionMetadata;

  // readonly persistence?: WorkflowPersistenceMetadata;

  // readonly signals?: WorkflowSignalMetadata;

  // readonly compensation?: WorkflowCompensationMetadata;

  // readonly childWorkflows?: WorkflowChildMetadata[];

  // readonly observability?: WorkflowObservabilityMetadata;
}
