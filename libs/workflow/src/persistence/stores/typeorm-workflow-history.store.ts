import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkflowExecutionHistoryStore } from '../../contracts/stores/workflow-execution-history.store';
import { WorkflowStepExecution } from '../../contracts/workflow-step-execution';

import { WorkflowStepHistoryEntity } from '../entities/workflow-step-history.entity';

@Injectable()
export class TypeOrmWorkflowHistoryStore implements WorkflowExecutionHistoryStore {
  constructor(
    @InjectRepository(WorkflowStepHistoryEntity)
    private readonly repository: Repository<WorkflowStepHistoryEntity>,
  ) {}

  async append(
    workflowId: string,
    execution: WorkflowStepExecution,
  ): Promise<void> {
    await this.repository.insert({
      workflowId,
      step: execution.step,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      error: execution.error,
    });
  }

  async findByWorkflowId(
    workflowId: string,
  ): Promise<readonly WorkflowStepExecution[]> {
    const entities = await this.repository.find({
      where: {
        workflowId,
      },
      order: {
        startedAt: 'ASC',
      },
    });

    return entities.map((entity) => ({
      step: entity.step as WorkflowStepExecution['step'],
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      durationMs: entity.durationMs,
      status: entity.status as WorkflowStepExecution['status'],
      error: entity.error,
    }));
  }
}
