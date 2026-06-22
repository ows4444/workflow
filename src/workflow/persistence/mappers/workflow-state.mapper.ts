import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';
import { WorkflowStateEntity } from '../entities/workflow-state.entity';

export class WorkflowStateMapper {
  static toEntity(state: WorkflowExecutionState): WorkflowStateEntity {
    return Object.assign(new WorkflowStateEntity(), state);
  }

  static toDomain(entity: WorkflowStateEntity): WorkflowExecutionState {
    return {
      ...entity,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      stepStartedAt: entity.stepStartedAt,
      completedAt: entity.completedAt,
      failedAt: entity.failedAt,
      data: entity.data,
      status: entity.status as WorkflowExecutionState['status'],
    };
  }
}
