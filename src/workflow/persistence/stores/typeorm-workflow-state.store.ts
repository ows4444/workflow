import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkflowStateStore } from '../../contracts/workflow-state-store';
import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';

import { WorkflowStateEntity } from '../entities/workflow-state.entity';
import { WorkflowStateMapper } from '../mappers/workflow-state.mapper';
import { WorkflowConcurrencyError } from '../../errors/workflow.errors';

@Injectable()
export class TypeOrmWorkflowStateStore implements WorkflowStateStore {
  constructor(
    @InjectRepository(WorkflowStateEntity)
    private readonly repository: Repository<WorkflowStateEntity>,
  ) {}

  async insert(state: WorkflowExecutionState): Promise<void> {
    await this.repository.insert(WorkflowStateMapper.toEntity(state));
  }

  async load(workflowId: string): Promise<WorkflowExecutionState | null> {
    const entity = await this.repository.findOne({
      where: {
        workflowId,
      },
    });

    return entity ? WorkflowStateMapper.toDomain(entity) : null;
  }

  async save(
    previousState: WorkflowExecutionState,
    nextState: WorkflowExecutionState,
  ): Promise<void> {
    const result = await this.repository.update(
      {
        workflowId: previousState.workflowId,
        stateVersion: previousState.stateVersion,
      },
      WorkflowStateMapper.toEntity(nextState),
    );

    if (result.affected !== 1) {
      throw new WorkflowConcurrencyError(
        `Workflow '${nextState.workflowId}' version mismatch`,
      );
    }
  }

  async delete(workflowId: string): Promise<void> {
    await this.repository.delete({
      workflowId,
    });
  }
}
