import { WorkflowSignal } from './workflow-signal';
import { WorkflowStepExecution } from './workflow-step-execution';
import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowExecutionState {
  readonly executionId: string;

  readonly workflowId: string;

  readonly workflowName: string;

  readonly status: 'running' | 'waiting' | 'completed' | 'failed';

  readonly recoveryReason?: 'process-crash' | 'timeout' | 'unknown';

  readonly waitingForSignal?: WorkflowSignal;

  readonly executingStep?: string;

  readonly stepStartedAt?: Date;

  readonly requiresRecovery?: boolean;

  readonly history: readonly WorkflowStepExecution[];

  readonly lastError?: string;

  readonly failedStep?: string;

  readonly failureCount?: number;

  readonly stateVersion: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;

  readonly completedAt?: Date;

  readonly failedAt?: Date;

  readonly workflowVersion: number;

  readonly currentStep?: WorkflowStepId;

  readonly iteration: number;

  readonly data: Readonly<Record<string, unknown>>;
}
