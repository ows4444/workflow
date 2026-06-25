import { Provider, Type } from '@nestjs/common';
import { WorkflowDefinitionMetadata } from './workflow-definition-metadata';
import { WorkflowRetryMetadata } from './workflow-retry-metadata';
import { WorkflowHookMetadata } from './workflow-hook-metadata';
import { WorkflowAutoResumeMetadata } from './workflow-auto-resume-metadata';
import { WorkflowRetentionMetadata } from './workflow-retention-metadata';
import { WorkflowCompensationMetadata } from './workflow-compensation-metadata';
import { WorkflowChildMetadata } from './workflow-child-metadata';
import { WorkflowObservabilityMetadata } from './workflow-observability-metadata';
import { WorkflowPersistenceMetadata } from './workflow-persistence-metadata';
import { WorkflowSignalMetadata } from './workflow-signal-metadata';

export interface WorkflowMetadata {
  readonly name: string;

  readonly version: number;

  readonly description?: string;

  readonly defaultStepTimeoutMs?: number;

  readonly imports?: Type<unknown>[];

  readonly providers?: Provider[];

  readonly exports?: Provider[];

  readonly definition: WorkflowDefinitionMetadata;

  readonly retries?: WorkflowRetryMetadata;

  readonly hooks?: WorkflowHookMetadata;

  readonly autoResume?: WorkflowAutoResumeMetadata;

  readonly retention?: WorkflowRetentionMetadata;

  readonly compensation?: WorkflowCompensationMetadata;

  readonly persistence?: WorkflowPersistenceMetadata;

  readonly signals?: WorkflowSignalMetadata;

  readonly childWorkflows?: WorkflowChildMetadata[];

  readonly observability?: WorkflowObservabilityMetadata;
}
