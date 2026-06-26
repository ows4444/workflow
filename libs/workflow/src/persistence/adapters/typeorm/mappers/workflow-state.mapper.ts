import { WorkflowExecutionState } from '../../../../models/workflow-execution-state';
import { createWorkflowStepId } from '../../../../models/workflow-step-id';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { WorkflowStateEntity } from '../entities/workflow-state.entity';

export class WorkflowStateMapper {
  static toPersistence(
    state: WorkflowExecutionState,
  ): QueryDeepPartialEntity<WorkflowStateEntity> {
    return {
      workflowId: state.workflowId,
      executionId: state.executionId,
      parentWorkflowId: state.parentWorkflowId,
      parentExecutionId: state.parentExecutionId,
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      status: state.status,
      currentStep: state.currentStep ? String(state.currentStep) : undefined,
      failedStep: state.failedStep,
      lastFailure: state.lastFailure,
      recoveryReason: state.recoveryReason,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: state.data as any,
      historyCount: state.historyCount,
      correlationId: state.correlationId,
      executingStep: state.executingStep
        ? String(state.executingStep)
        : undefined,
      resumeStep: state.resumeStep ? String(state.resumeStep) : undefined,
      stepRetryCount: state.stepRetryCount,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      waitingForSignal: state.waitingForSignal as any,
      waitingSince: state.waitingSince,
      iteration: state.iteration,
      failureCount: state.failureCount,
      requiresRecovery: state.requiresRecovery,
      recoveryAttempts: state.recoveryAttempts,
      retryAt: state.retryAt,
      leaseOwner: state.leaseOwner,
      leaseExpiresAt: state.leaseExpiresAt,
      lastRecoveryAt: state.lastRecoveryAt,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt,
      failedAt: state.failedAt,
      stepStartedAt: state.stepStartedAt,
      stateVersion: state.stateVersion,
    };
  }

  static toDomain(entity: WorkflowStateEntity): WorkflowExecutionState {
    return {
      workflowId: entity.workflowId,
      executionId: entity.executionId,
      parentWorkflowId: entity.parentWorkflowId,
      parentExecutionId: entity.parentExecutionId,
      workflowName: entity.workflowName,
      workflowVersion: entity.workflowVersion,
      status: entity.status,

      ...(entity.currentStep
        ? { currentStep: createWorkflowStepId(entity.currentStep) }
        : {}),
      failedStep: entity.failedStep,
      lastFailure: entity.lastFailure,
      recoveryReason: entity.recoveryReason,
      data: entity.data,
      historyCount: entity.historyCount,
      correlationId: entity.correlationId,
      ...(entity.executingStep
        ? { executingStep: createWorkflowStepId(entity.executingStep) }
        : {}),

      ...(entity.resumeStep
        ? { resumeStep: createWorkflowStepId(entity.resumeStep) }
        : {}),

      stepRetryCount: entity.stepRetryCount,
      waitingForSignal: entity.waitingForSignal,
      waitingSince: entity.waitingSince,
      iteration: entity.iteration,
      failureCount: entity.failureCount,
      requiresRecovery: entity.requiresRecovery,
      recoveryAttempts: entity.recoveryAttempts,
      leaseOwner: entity.leaseOwner,
      leaseExpiresAt: entity.leaseExpiresAt,
      lastRecoveryAt: entity.lastRecoveryAt,
      retryAt: entity.retryAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt,
      failedAt: entity.failedAt,
      stepStartedAt: entity.stepStartedAt,
      stateVersion: entity.stateVersion,
    };
  }
}
