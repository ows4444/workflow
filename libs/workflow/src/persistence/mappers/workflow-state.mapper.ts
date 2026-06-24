import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';
import { WorkflowStateEntity } from '../entities/workflow-state.entity';
import { createWorkflowStepId } from '../../contracts/workflow-step-id';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export class WorkflowStateMapper {
  static toPersistence(
    state: WorkflowExecutionState,
  ): QueryDeepPartialEntity<WorkflowStateEntity> {
    return {
      workflowId: state.workflowId,
      executionId: state.executionId,
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      status: state.status,
      currentStep: state.currentStep,
      failedStep: state.failedStep,
      lastFailure: state.lastFailure,
      recoveryReason: state.recoveryReason,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: state.data as any,
      historyCount: state.historyCount,
      correlationId: state.correlationId,
      executingStep: state.executingStep,
      resumeStep: state.resumeStep,
      retryCount: state.retryCount,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      waitingForSignal: state.waitingForSignal as any,
      iteration: state.iteration,
      failureCount: state.failureCount,
      requiresRecovery: state.requiresRecovery,
      recoveryAttempts: state.recoveryAttempts,
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

      retryCount: entity.retryCount,
      waitingForSignal: entity.waitingForSignal,
      iteration: entity.iteration,
      failureCount: entity.failureCount,
      requiresRecovery: entity.requiresRecovery,
      recoveryAttempts: entity.recoveryAttempts,
      lastRecoveryAt: entity.lastRecoveryAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt,
      failedAt: entity.failedAt,
      stepStartedAt: entity.stepStartedAt,
      stateVersion: entity.stateVersion,
    };
  }
}
