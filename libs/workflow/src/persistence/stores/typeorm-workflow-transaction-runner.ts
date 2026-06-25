import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WorkflowTransactionRunner } from '../../contracts/stores/workflow-transaction-runner';
import { TypeOrmWorkflowTransactionContext } from './typeorm-workflow-transaction-context';

@Injectable()
export class TypeOrmWorkflowTransactionRunner implements WorkflowTransactionRunner {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TypeOrmWorkflowTransactionContext,
  ) {}

  execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      this.context.run(manager, operation),
    );
  }
}
