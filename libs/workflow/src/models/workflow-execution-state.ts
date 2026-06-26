import { WorkflowStatus } from '../types/workflow-status';
import { WorkflowFailure } from './workflow-failure';
import { WorkflowSignal } from './workflow-signal';
import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowExecutionState<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly executionId: string;

  readonly parentWorkflowId?: string;

  readonly parentExecutionId?: string;

  readonly correlationId: string;

  readonly workflowId: string;

  readonly workflowName: string;

  readonly status: WorkflowStatus;

  readonly recoveryReason?: 'process-crash' | 'timeout' | 'unknown';

  readonly recoveryAttempts?: number;

  readonly retryAt?: Date;

  readonly lastRecoveryAt?: Date;

  readonly waitingForSignal?: WorkflowSignal;

  readonly waitingSince?: Date;

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

  readonly stepRetryCount?: number;

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
