import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import {
  WORKFLOW_ARCHIVE_STORE,
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_METRICS,
  WORKFLOW_RETRY_JITTER,
  WORKFLOW_RETRY_SCHEDULER,
  WORKFLOW_SIGNAL_STORE,
  WORKFLOW_STATE_STORE,
  WORKFLOW_TRANSACTION_RUNNER,
} from '../constants/workflow.tokens';
import { WorkflowCompensationService } from '../engine/compensation/service';
import { WorkflowExecutor } from '../engine/executor/executor';
import { WorkflowRunner } from '../engine/executor/runner';
import { WorkflowStepExecutor } from '../engine/executor/step-executor';
import { WorkflowStepPersistenceService } from '../engine/executor/step-persistence';
import { WorkflowStepResolver } from '../engine/executor/step-resolver';
import { WorkflowHookExecutor } from '../engine/hooks/hook-executor';
import { WorkflowCompletionService } from '../engine/lifecycle/completion.service';
import { WorkflowFailureService } from '../engine/lifecycle/failure.service';
import { WorkflowLifecyclePublisher } from '../engine/lifecycle/lifecycle.publisher';
import { WorkflowLifecycleService } from '../engine/lifecycle/lifecycle.service';
import { WorkflowDiscovery } from '../engine/registry/discovery';
import { WorkflowRegistry } from '../engine/registry/registry';
import { WorkflowAutoRecoveryService } from '../engine/retry/auto-recovery.service';
import { DefaultWorkflowRetryJitterService } from '../engine/retry/default-jitter.service';
import { DefaultWorkflowRetryScheduler } from '../engine/retry/default-scheduler.service';
import { WorkflowRetryDelayService } from '../engine/retry/delay.service';
import { WorkflowRecoveryService } from '../engine/retry/recovery.service';
import { WorkflowRetryService } from '../engine/retry/retry.service';
import { WorkflowSignalProcessor } from '../engine/signals/signal.processor';
import { WorkflowSignalService } from '../engine/signals/signal.service';
import { WorkflowStateFactory } from '../engine/state/factory';
import { WorkflowStateService } from '../engine/state/service';
import { WorkflowTransitionValidator } from '../engine/state/transition-validator';
import { WorkflowStateTransitions } from '../engine/state/transitions';
import { WorkflowStateValidator } from '../engine/state/validator';
import { WorkflowDefinitionValidator } from '../engine/validation/definition.validator';
import { WorkflowStepResultValidator } from '../engine/validation/step-result.validator';
import { WorkflowLeaseService } from '../infrastructure/lease/lease.service';
import { WorkflowLogger } from '../observability/logger';
import { NoopWorkflowMetricsService } from '../observability/noop-metrics.service';
import { WorkflowHistoryService } from '../persistence/history.service';
import { WorkflowRetentionService } from '../retention/retention.service';
import { InMemoryHistoryStore } from '../testing/fakes/in-memory-history.store';
import { InMemoryIdempotencyStore } from '../testing/fakes/in-memory-idempotency.store';
import { InMemoryWorkflowSignalStore } from '../testing/fakes/in-memory-workflow-signal.store';
import { InMemoryWorkflowStateStore } from '../testing/fakes/in-memory-workflow-state.store';
import { InMemoryWorkflowTransactionRunner } from '../testing/fakes/in-memory-workflow-transaction-runner';
import { WorkflowClient } from './api/workflow-client';
import { WorkflowQueryService } from './api/workflow-query.service';
import { NoopWorkflowArchiveStore } from '../retention/noop-archive.store';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WorkflowStateTransitions,
    WorkflowQueryService,
    WorkflowStateValidator,
    WorkflowStateFactory,
    WorkflowStateService,

    WorkflowCompletionService,
    WorkflowHookExecutor,
    WorkflowLifecyclePublisher,
    WorkflowLifecycleService,
    WorkflowRunner,
    WorkflowCompensationService,
    WorkflowTransitionValidator,
    WorkflowStepResultValidator,
    DefaultWorkflowRetryJitterService,
    DefaultWorkflowRetryScheduler,
    NoopWorkflowArchiveStore,

    {
      provide: WORKFLOW_ARCHIVE_STORE,
      useExisting: NoopWorkflowArchiveStore,
    },

    {
      provide: WORKFLOW_RETRY_JITTER,
      useExisting: DefaultWorkflowRetryJitterService,
    },

    {
      provide: WORKFLOW_RETRY_SCHEDULER,
      useExisting: DefaultWorkflowRetryScheduler,
    },
    WorkflowClient,
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
    WorkflowLeaseService,
    WorkflowLogger,
    WorkflowRetentionService,

    InMemoryIdempotencyStore,
    InMemoryWorkflowStateStore,
    InMemoryHistoryStore,
    InMemoryWorkflowSignalStore,
    InMemoryWorkflowTransactionRunner,
    NoopWorkflowMetricsService,

    {
      provide: WORKFLOW_METRICS,
      useExisting: NoopWorkflowMetricsService,
    },

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
    WorkflowClient,
    WorkflowQueryService,
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
