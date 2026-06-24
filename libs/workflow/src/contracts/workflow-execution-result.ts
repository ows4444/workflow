import { WorkflowStatus } from './workflow-status';

export interface WorkflowExecutionResult {
  readonly workflowId: string;

  readonly status: WorkflowStatus;

  readonly currentStep?: string;

  readonly iteration: number;

  readonly data: Readonly<Record<string, unknown>>;
}
