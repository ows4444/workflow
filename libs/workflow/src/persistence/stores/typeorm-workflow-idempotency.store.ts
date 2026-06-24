import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { WorkflowIdempotencyStore } from '../../contracts/stores/workflow-idempotency-store';
import { WorkflowIdempotencyEntity } from '../entities/workflow-idempotency.entity';

@Injectable()
export class TypeOrmWorkflowIdempotencyStore implements WorkflowIdempotencyStore {
  constructor(
    @InjectRepository(WorkflowIdempotencyEntity)
    private readonly repository: Repository<WorkflowIdempotencyEntity>,
  ) {}

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
      if (
        error instanceof QueryFailedError &&
        (error.driverError?.code === 'ER_DUP_ENTRY' ||
          error.driverError?.code === '23505')
      ) {
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
}
