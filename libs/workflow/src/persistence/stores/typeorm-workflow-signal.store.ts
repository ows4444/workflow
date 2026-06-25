import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WorkflowSignalStore } from '../../contracts/stores/workflow-signal.store';
import { WorkflowSignalRecord } from '../../contracts/workflow-signal-record';
import { WorkflowSignalEntity } from '../entities/workflow-signal.entity';
import { TypeOrmWorkflowTransactionContext } from './typeorm-workflow-transaction-context';
import { isDuplicateKeyError } from '../utils/is-duplicate-query-error';

@Injectable()
export class TypeOrmWorkflowSignalStore implements WorkflowSignalStore {
  constructor(
    @InjectRepository(WorkflowSignalEntity)
    private readonly defaultRepository: Repository<WorkflowSignalEntity>,

    private readonly context: TypeOrmWorkflowTransactionContext,

    private readonly dataSource: DataSource,
  ) {}

  private get repository(): Repository<WorkflowSignalEntity> {
    return (
      this.context.get()?.getRepository(WorkflowSignalEntity) ??
      this.dataSource.getRepository(WorkflowSignalEntity)
    );
  }

  async load(signalId: string): Promise<WorkflowSignalRecord | null> {
    const entity = await this.repository.findOne({
      where: {
        signalId,
      },
    });

    if (!entity) {
      return null;
    }

    return {
      signalId: entity.signalId,
      workflowId: entity.workflowId,
      processed: entity.processed,
      createdAt: entity.createdAt,
      processedAt: entity.processedAt,
      signal: {
        signalId: entity.signalId,
        name: entity.signalName,
        payload: entity.payload,
      },
    };
  }

  async insert(record: WorkflowSignalRecord): Promise<void> {
    try {
      await this.repository.insert({
        signalId: record.signalId,
        workflowId: record.workflowId,
        signalName: record.signal.name,
        payload: record.signal.payload as Record<string, unknown> | undefined,
        processed: record.processed,
        createdAt: record.createdAt,
        processedAt: record.processedAt,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return; // idempotent — signal already persisted
      }

      throw error;
    }
  }

  async exists(signalId: string): Promise<boolean> {
    return this.repository.exists({
      where: {
        signalId,
      },
    });
  }

  async markProcessed(signalId: string): Promise<void> {
    await this.repository.update(
      { signalId },
      {
        processed: true,
        processedAt: new Date(),
      },
    );
  }

  async findPending(
    workflowId: string,
  ): Promise<readonly WorkflowSignalRecord[]> {
    const entities = await this.repository.find({
      where: {
        workflowId,
        processed: false,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => ({
      signalId: entity.signalId,
      workflowId: entity.workflowId,
      processed: entity.processed,
      createdAt: entity.createdAt,
      processedAt: entity.processedAt,
      signal: {
        signalId: entity.signalId,
        name: entity.signalName,
        payload: entity.payload,
      },
    }));
  }
}
