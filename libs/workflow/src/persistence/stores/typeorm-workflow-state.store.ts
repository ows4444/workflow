import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { WorkflowStateStore } from '../../contracts/stores/workflow-state-store';
import { WorkflowExecutionState } from '../../contracts/workflow-execution-state';
import { WorkflowStateEntity } from '../entities/workflow-state.entity';
import { WorkflowStateMapper } from '../mappers/workflow-state.mapper';
import { WorkflowConcurrencyError } from '../../errors/workflow.errors';
import { WorkflowStatus } from '../../contracts/workflow-status';
import { TypeOrmWorkflowTransactionContext } from './typeorm-workflow-transaction-context';
import { isDuplicateKeyError } from '../utils/is-duplicate-query-error';

@Injectable()
export class TypeOrmWorkflowStateStore implements WorkflowStateStore {
  constructor(
    @InjectRepository(WorkflowStateEntity)
    private readonly defaultRepository: Repository<WorkflowStateEntity>,
    private readonly context: TypeOrmWorkflowTransactionContext,
    private readonly dataSource: DataSource,
  ) {}

  private get repository(): Repository<WorkflowStateEntity> {
    return (
      this.context.get()?.getRepository(WorkflowStateEntity) ??
      this.dataSource.getRepository(WorkflowStateEntity)
    );
  }

  async acquireLease(
    workflowId: string,
    owner: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
        leaseOwner: owner,
        leaseExpiresAt: expiresAt,
      })
      .where('workflowId = :workflowId', { workflowId })
      .andWhere(
        '(leaseExpiresAt IS NULL OR leaseExpiresAt < :now OR leaseOwner = :owner)',
        {
          now: new Date(),
          owner,
        },
      )
      .execute();

    return result.affected === 1;
  }

  async renewLease(
    workflowId: string,
    owner: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
        leaseExpiresAt: expiresAt,
      })
      .where('workflowId = :workflowId', { workflowId })
      .andWhere('leaseOwner = :owner', { owner })
      .execute();

    return result.affected === 1;
  }

  async releaseLease(workflowId: string, owner: string): Promise<void> {
    await this.repository.update(
      {
        workflowId,
        leaseOwner: owner,
      },
      {
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
      },
    );
  }

  async insert(state: WorkflowExecutionState): Promise<void> {
    try {
      await this.repository.insert(WorkflowStateMapper.toPersistence(state));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new WorkflowConcurrencyError(
          `Workflow '${state.workflowId}' already exists`,
        );
      }

      throw error;
    }
  }

  async findRecoverable(
    readyAt = new Date(),
  ): Promise<WorkflowExecutionState[]> {
    return this.repository
      .find({
        where: [
          { requiresRecovery: true, retryAt: IsNull() },
          { requiresRecovery: true, retryAt: LessThanOrEqual(readyAt) },
        ],
      })
      .then((entities) => entities.map((e) => WorkflowStateMapper.toDomain(e)));
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

  async findWaitingExpired(
    olderThanMs: number,
  ): Promise<WorkflowExecutionState[]> {
    const threshold = new Date(Date.now() - olderThanMs);

    return this.repository
      .find({ where: { status: 'waiting', updatedAt: LessThan(threshold) } })
      .then((entities) => entities.map((e) => WorkflowStateMapper.toDomain(e)));
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

  async deleteCompleted(
    workflowName?: string,
    workflowVersion?: number,
    olderThanMs = 0,
    limit?: number,
  ): Promise<number> {
    const threshold = new Date(Date.now() - olderThanMs);

    const qb = this.repository
      .createQueryBuilder('w')
      .select('w.id', 'id')
      .where('w.status = :status', { status: 'completed' })
      .andWhere('w.completedAt < :threshold', { threshold });

    if (workflowName !== undefined) {
      qb.andWhere('w.workflowName = :workflowName', { workflowName });
    }

    if (workflowVersion !== undefined) {
      qb.andWhere('w.workflowVersion = :workflowVersion', {
        workflowVersion,
      });
    }

    qb.orderBy('w.completedAt', 'ASC');

    if (limit !== undefined) {
      qb.take(limit);
    }

    const ids = await qb.getRawMany<{ id: string }>();

    if (ids.length === 0) {
      return 0;
    }

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .whereInIds(ids.map((x) => x.id))
      .execute();

    return result.affected ?? 0;
  }

  async findCompleted(
    workflowName?: string,
    workflowVersion?: number,
    olderThanMs = 0,
  ): Promise<WorkflowExecutionState[]> {
    const threshold = new Date(Date.now() - olderThanMs);

    const where: FindOptionsWhere<WorkflowStateEntity> = {
      status: 'completed',
      completedAt: LessThan(threshold),
    };

    if (workflowName !== undefined) {
      where.workflowName = workflowName;
    }

    if (workflowVersion !== undefined) {
      where.workflowVersion = workflowVersion;
    }

    return this.repository
      .find({ where })
      .then((entities) => entities.map((e) => WorkflowStateMapper.toDomain(e)));
  }

  async delete(workflowId: string): Promise<void> {
    await this.repository.delete({
      workflowId,
    });
  }
}
