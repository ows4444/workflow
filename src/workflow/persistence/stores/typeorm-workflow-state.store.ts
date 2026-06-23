import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';

import { WorkflowStateStore } from '../../contracts/workflow-state-store';
import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';

import { WorkflowStateEntity } from '../entities/workflow-state.entity';
import { WorkflowStateMapper } from '../mappers/workflow-state.mapper';
import { WorkflowConcurrencyError } from '../../errors/workflow.errors';
import { WorkflowStatus } from '../../contracts/workflow-status';

@Injectable()
export class TypeOrmWorkflowStateStore implements WorkflowStateStore {
  constructor(
    @InjectRepository(WorkflowStateEntity)
    private readonly repository: Repository<WorkflowStateEntity>,
  ) {}

  async insert(state: WorkflowExecutionState): Promise<void> {
    try {
      await this.repository.insert(WorkflowStateMapper.toPersistence(state));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError?.code === 'ER_DUP_ENTRY' ||
          error.driverError?.code === '23505')
      ) {
        throw new WorkflowConcurrencyError(
          `Workflow '${state.workflowId}' already exists`,
        );
      }

      throw error;
    }
  }

  async findStuck(olderThanMs: number): Promise<WorkflowExecutionState[]> {
    const threshold = new Date(Date.now() - olderThanMs);

    return this.repository
      .find({
        where: { status: 'running', stepStartedAt: LessThan(threshold) },
      })
      .then((entities) => entities.map((e) => WorkflowStateMapper.toDomain(e)));
  }

  async findRunning(): Promise<WorkflowExecutionState[]> {
    return this.findByStatus('running');
  }

  async findFailed(): Promise<WorkflowExecutionState[]> {
    return this.findByStatus('failed');
  }

  async load(workflowId: string): Promise<WorkflowExecutionState | null> {
    const entity = await this.repository.findOne({
      where: {
        workflowId,
      },
    });

    return entity ? WorkflowStateMapper.toDomain(entity) : null;
  }

  async findWaiting(): Promise<WorkflowExecutionState[]> {
    return this.findByStatus('waiting');
  }

  async save(
    previousState: WorkflowExecutionState,
    nextState: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    const result = await this.repository.update(
      {
        workflowId: previousState.workflowId,
        stateVersion: previousState.stateVersion,
      },
      WorkflowStateMapper.toPersistence(nextState),
    );

    if (result.affected !== 1) {
      throw new WorkflowConcurrencyError(
        `Workflow '${nextState.workflowId}' version mismatch`,
      );
    }

    return nextState;
  }

  private async findByStatus(
    status: WorkflowStatus,
  ): Promise<WorkflowExecutionState[]> {
    return this.repository
      .find({
        where: { status },
      })
      .then((entities) => entities.map((e) => WorkflowStateMapper.toDomain(e)));
  }

  async deleteCompleted(olderThanMs = 0): Promise<number> {
    const threshold = new Date(Date.now() - olderThanMs);

    const result = await this.repository.delete({
      status: 'completed',
      completedAt: LessThan(threshold),
    });

    return result.affected ?? 0;
  }

  async delete(workflowId: string): Promise<void> {
    await this.repository.delete({
      workflowId,
    });
  }
}
