import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowStateEntity } from './entities/workflow-state.entity';
import { WorkflowSignalEntity } from './entities/workflow-signal.entity';
import { WorkflowStepHistoryEntity } from './entities/workflow-step-history.entity';

import { TypeOrmWorkflowStateStore } from './stores/typeorm-workflow-state.store';
import { TypeOrmWorkflowSignalStore } from './stores/typeorm-workflow-signal.store';
import { TypeOrmWorkflowHistoryStore } from './stores/typeorm-workflow-history.store';

import {
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_SIGNAL_STORE,
  WORKFLOW_STATE_STORE,
  WORKFLOW_TRANSACTION_RUNNER,
} from '../constants/workflow.tokens';
import { WorkflowIdempotencyEntity } from './entities/workflow-idempotency.entity';
import { TypeOrmWorkflowIdempotencyStore } from './stores/typeorm-workflow-idempotency.store';
import { TypeOrmWorkflowTransactionRunner } from './stores/typeorm-workflow-transaction-runner';
import { TypeOrmWorkflowTransactionContext } from './stores/typeorm-workflow-transaction-context';

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
    WORKFLOW_STATE_STORE,
    WORKFLOW_SIGNAL_STORE,
    WORKFLOW_HISTORY_STORE,
    WORKFLOW_IDEMPOTENCY_STORE,
    WORKFLOW_TRANSACTION_RUNNER,
  ],
})
export class WorkflowPersistenceModule {}
