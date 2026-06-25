import { WorkflowFailure } from './workflow-failure';
import { WorkflowSignal } from './workflow-signal';
import { WorkflowStatus } from './workflow-status';
import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowExecutionState<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly executionId: string;

  readonly correlationId?: string;

  readonly workflowId: string;

  readonly workflowName: string;

  readonly status: WorkflowStatus;

  readonly recoveryReason?: 'process-crash' | 'timeout' | 'unknown';

  readonly recoveryAttempts?: number;

  readonly lastRecoveryAt?: Date;

  readonly waitingForSignal?: WorkflowSignal;

  readonly resumeStep?: WorkflowStepId;

  readonly executingStep?: WorkflowStepId;

  readonly stepStartedAt?: Date;

  readonly requiresRecovery?: boolean;

  readonly leaseOwner?: string;

  readonly leaseExpiresAt?: Date;

  readonly historyCount: number;

  readonly lastFailure?: WorkflowFailure;

  readonly failedStep?: string;

  readonly failureCount?: number;

  readonly retryCount?: number;

  readonly stateVersion: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;

  readonly completedAt?: Date;

  readonly failedAt?: Date;

  readonly workflowVersion: number;

  readonly currentStep?: WorkflowStepId;

  readonly iteration: number;

  readonly data: Readonly<TState>;
}
