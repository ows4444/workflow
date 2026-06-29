import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_QUERY_STORE,
  WORKFLOW_SIGNAL_STORE,
  WORKFLOW_STATE_STORE,
  WORKFLOW_TRANSACTION_RUNNER,
} from '../constants/workflow.tokens';
import { WorkflowIdempotencyEntity } from './adapters/typeorm/entities/workflow-idempotency.entity';
import { WorkflowSignalEntity } from './adapters/typeorm/entities/workflow-signal.entity';
import { WorkflowStateEntity } from './adapters/typeorm/entities/workflow-state.entity';
import { WorkflowStepHistoryEntity } from './adapters/typeorm/entities/workflow-step-history.entity';
import { TypeOrmWorkflowHistoryStore } from './adapters/typeorm/stores/typeorm-workflow-history.store';
import { TypeOrmWorkflowIdempotencyStore } from './adapters/typeorm/stores/typeorm-workflow-idempotency.store';
import { TypeOrmWorkflowSignalStore } from './adapters/typeorm/stores/typeorm-workflow-signal.store';
import { TypeOrmWorkflowStateStore } from './adapters/typeorm/stores/typeorm-workflow-state.store';
import { TypeOrmWorkflowTransactionContext } from './adapters/typeorm/stores/typeorm-workflow-transaction-context';
import { TypeOrmWorkflowTransactionRunner } from './adapters/typeorm/stores/typeorm-workflow-transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowStateEntity,
      WorkflowSignalEntity,
      WorkflowStepHistoryEntity,
      WorkflowIdempotencyEntity,
    ]),
  ],

  providers: [
    TypeOrmWorkflowTransactionContext,
    TypeOrmWorkflowTransactionRunner,

    TypeOrmWorkflowStateStore,
    TypeOrmWorkflowSignalStore,
    TypeOrmWorkflowHistoryStore,
    TypeOrmWorkflowIdempotencyStore,

    {
      provide: WORKFLOW_QUERY_STORE,
      useExisting: TypeOrmWorkflowStateStore,
    },

    {
      provide: WORKFLOW_IDEMPOTENCY_STORE,
      useExisting: TypeOrmWorkflowIdempotencyStore,
    },

    {
      provide: WORKFLOW_STATE_STORE,
      useExisting: TypeOrmWorkflowStateStore,
    },

    {
      provide: WORKFLOW_SIGNAL_STORE,
      useExisting: TypeOrmWorkflowSignalStore,
    },

    {
      provide: WORKFLOW_HISTORY_STORE,
      useExisting: TypeOrmWorkflowHistoryStore,
    },
    {
      provide: WORKFLOW_TRANSACTION_RUNNER,
      useExisting: TypeOrmWorkflowTransactionRunner,
    },
  ],

  exports: [
    TypeOrmWorkflowTransactionContext,
    TypeOrmWorkflowTransactionRunner,
    WORKFLOW_STATE_STORE,
    WORKFLOW_SIGNAL_STORE,
    WORKFLOW_HISTORY_STORE,
    WORKFLOW_IDEMPOTENCY_STORE,
    WORKFLOW_TRANSACTION_RUNNER,
  ],
})
export class WorkflowPersistenceModule {}
