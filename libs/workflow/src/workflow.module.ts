import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import {
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_SIGNAL_STORE,
  WORKFLOW_STATE_STORE,
  WORKFLOW_TRANSACTION_RUNNER,
} from './constants/workflow.tokens';
import { WorkflowRegistry } from './services/workflow.registry';
import { WorkflowDiscovery } from './services/workflow.discovery';
import { WorkflowDefinitionValidator } from './services/workflow-definition.validator';
import { WorkflowStepResolver } from './services/workflow-step-resolver';
import { WorkflowExecutor } from './services/workflow.executor';

import { WorkflowRecoveryService } from './services/workflow-recovery.service';
import { WorkflowStateValidator } from './services/workflow-state.validator';
import { WorkflowStateFactory } from './services/workflow-state.factory';
import { WorkflowHistoryService } from './services/workflow-history.service';
import { WorkflowSignalService } from './services/workflow-signal.service';

import { InMemoryHistoryStore } from './services/in-memory-history.store';
import { InMemoryIdempotencyStore } from './services/in-memory-idempotency.store';
import { InMemoryWorkflowStateStore } from './services/in-memory-workflow-state.store';
import { InMemoryWorkflowSignalStore } from './services/in-memory-workflow-signal.store';

import { WorkflowAutoRecoveryService } from './services/workflow-auto-recovery.service';

import { WorkflowStepExecutor } from './services/workflow-step.executor';
import { WorkflowFailureService } from './services/workflow-failure.service';
import { InMemoryWorkflowTransactionRunner } from './services/in-memory-workflow-transaction-runner';
import { WorkflowCompletionService } from './services/workflow-completion.service';
import { WorkflowStepPersistenceService } from './services/workflow-step-persistence.service';
import { WorkflowRetryService } from './services/workflow-retry.service';
import { WorkflowSignalProcessor } from './services/workflow-signal.processor';
import { WorkflowHookExecutor } from './services/workflow-hook.executor';
import { WorkflowTransitionValidator } from './services/workflow-transition.validator';
import { WorkflowLifecycleService } from './services/workflow-lifecycle.service';
import { WorkflowRunner } from './services/workflow-runner.service';
import { WorkflowLifecyclePublisher } from './services/workflow-lifecycle.publisher';
import { WorkflowRetryDelayService } from './services/workflow-retry-delay.service';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WorkflowStateValidator,
    WorkflowStateFactory,

    WorkflowCompletionService,
    WorkflowHookExecutor,
    WorkflowLifecyclePublisher,
    WorkflowLifecycleService,
    WorkflowRunner,
    WorkflowTransitionValidator,

    WorkflowRegistry,
    WorkflowDiscovery,
    WorkflowDefinitionValidator,
    WorkflowStepResolver,
    WorkflowExecutor,
    WorkflowStepExecutor,
    WorkflowRecoveryService,
    WorkflowHistoryService,
    WorkflowStepPersistenceService,
    WorkflowSignalService,
    WorkflowSignalProcessor,
    WorkflowAutoRecoveryService,
    WorkflowFailureService,
    WorkflowRetryService,
    WorkflowRetryDelayService,

    InMemoryIdempotencyStore,
    InMemoryWorkflowStateStore,
    InMemoryHistoryStore,
    InMemoryWorkflowSignalStore,
    InMemoryWorkflowTransactionRunner,

    {
      provide: WORKFLOW_HISTORY_STORE,
      useExisting: InMemoryHistoryStore,
    },
    {
      provide: WORKFLOW_IDEMPOTENCY_STORE,
      useExisting: InMemoryIdempotencyStore,
    },
    {
      provide: WORKFLOW_STATE_STORE,
      useExisting: InMemoryWorkflowStateStore,
    },
    {
      provide: WORKFLOW_SIGNAL_STORE,
      useExisting: InMemoryWorkflowSignalStore,
    },

    {
      provide: WORKFLOW_TRANSACTION_RUNNER,
      useExisting: InMemoryWorkflowTransactionRunner,
    },
  ],
  exports: [
    WorkflowRegistry,
    WorkflowStepResolver,
    WorkflowExecutor,
    WorkflowSignalService,
    WORKFLOW_IDEMPOTENCY_STORE,
    WORKFLOW_STATE_STORE,
    WORKFLOW_HISTORY_STORE,
    WORKFLOW_SIGNAL_STORE,
    WORKFLOW_TRANSACTION_RUNNER,
    WorkflowRecoveryService,
  ],
})
export class WorkflowModule {}
