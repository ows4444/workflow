import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowStepMetadata {
  readonly workflow: string;

  readonly workflowVersion?: number;

  readonly step: WorkflowStepId;

  readonly timeoutMs?: number;
}
