export interface WorkflowStateFields {
  workflowId: string;
  executionId: string;
  workflowName: string;
  workflowVersion: number;
  status: string;

  currentStep?: string;
  failedStep?: string;

  historyCount: number;
  iteration: number;
  stateVersion: number;

  createdAt: Date;
  updatedAt: Date;

  completedAt?: Date;
  failedAt?: Date;
  stepStartedAt?: Date;

  correlationId?: string;
  executingStep?: string;

  retryCount?: number;
  failureCount?: number;

  requiresRecovery?: boolean;

  recoveryReason?: string;

  lastFailure?: unknown;
  waitingForSignal?: unknown;

  data: Record<string, unknown>;
}
