import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WorkflowIdempotencyStore } from '../../contracts/stores/workflow-idempotency-store';
import { WorkflowIdempotencyEntity } from '../entities/workflow-idempotency.entity';
import { TypeOrmWorkflowTransactionContext } from './typeorm-workflow-transaction-context';
import { isDuplicateKeyError } from '../utils/is-duplicate-query-error';

@Injectable()
export class TypeOrmWorkflowIdempotencyStore implements WorkflowIdempotencyStore {
  constructor(
    @InjectRepository(WorkflowIdempotencyEntity)
    private readonly defaultRepository: Repository<WorkflowIdempotencyEntity>,

    private readonly context: TypeOrmWorkflowTransactionContext,

    private readonly dataSource: DataSource,
  ) {}

  private get repository(): Repository<WorkflowIdempotencyEntity> {
    return (
      this.context.get()?.getRepository(WorkflowIdempotencyEntity) ??
      this.dataSource.getRepository(WorkflowIdempotencyEntity)
    );
  }

  async acquire(key: string, workflowId: string): Promise<boolean> {
    try {
      await this.repository.insert({
        key,
        workflowId,
        completed: false,
        createdAt: new Date(),
      });

      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }

      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    return this.repository.exists({
      where: { key },
    });
  }

  async markCompleted(key: string, workflowId: string): Promise<void> {
    await this.repository.update(
      {
        key,
        workflowId,
      },
      {
        completed: true,
        completedAt: new Date(),
      },
    );
  }

  async deleteByWorkflowId(workflowId: string): Promise<void> {
    await this.repository.delete({
      workflowId,
    });
  }
}
