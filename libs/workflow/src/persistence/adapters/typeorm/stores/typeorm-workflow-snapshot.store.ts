import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { RegisteredWorkflow } from '../../../../models/registered-workflow';
import { WorkflowExecutionState } from '../../../../models/workflow-execution-state';
import { WorkflowSnapshotStore } from '../../../../ports/workflow-snapshot.store';
import { WorkflowSnapshotEntity } from '../entities/workflow-snapshot.entity';
import { WorkflowSnapshotMapper } from '../mappers/workflow-snapshot.mapper';
import { TypeOrmWorkflowTransactionContext } from './typeorm-workflow-transaction-context';

@Injectable()
export class TypeOrmWorkflowSnapshotStore implements WorkflowSnapshotStore {
  constructor(
    @InjectRepository(WorkflowSnapshotEntity)
    private readonly defaultRepository: Repository<WorkflowSnapshotEntity>,

    private readonly context: TypeOrmWorkflowTransactionContext,

    private readonly dataSource: DataSource,
  ) {}

  private get repository(): Repository<WorkflowSnapshotEntity> {
    return (
      this.context.get()?.getRepository(WorkflowSnapshotEntity) ??
      this.dataSource.getRepository(WorkflowSnapshotEntity)
    );
  }

  async load(workflowId: string): Promise<WorkflowExecutionState | null> {
    const entity = await this.repository.findOne({
      where: { workflowId },
    });

    return entity ? WorkflowSnapshotMapper.toDomain(entity) : null;
  }

  async snapshot(
    _workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const persistence = WorkflowSnapshotMapper.toPersistence(state);

    const existing = await this.repository.findOne({
      where: { workflowId: state.workflowId },
    });

    if (existing) {
      await this.repository.update(
        { workflowId: state.workflowId },
        {
          stateVersion: persistence.stateVersion,
          historyCount: persistence.historyCount,
          state: persistence.state,
          createdAt: new Date(),
        },
      );
    } else {
      await this.repository.insert(persistence);
    }
  }
}
