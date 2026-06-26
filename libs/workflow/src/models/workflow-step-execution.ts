import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowStepExecution {
  readonly step: WorkflowStepId;

  readonly startedAt: Date;

  readonly completedAt?: Date;

  readonly durationMs?: number;

  readonly status: 'started' | 'completed' | 'failed';

  readonly error?: string;
}
