import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import {
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_SIGNAL_STORE,
  WORKFLOW_STATE_STORE,
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
import { WorkflowExecutionFactory } from './domain/workflow-execution.factory';
import { WorkflowStepExecutor } from './services/workflow-step.executor';
import { WorkflowFailureService } from './services/workflow-failure.service';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WorkflowStateValidator,
    WorkflowStateFactory,
    WorkflowExecutionFactory,
    WorkflowRegistry,
    WorkflowDiscovery,
    WorkflowDefinitionValidator,
    WorkflowStepResolver,
    WorkflowExecutor,
    WorkflowStepExecutor,
    WorkflowRecoveryService,
    WorkflowHistoryService,
    WorkflowSignalService,
    WorkflowAutoRecoveryService,
    WorkflowFailureService,

    InMemoryIdempotencyStore,
    InMemoryWorkflowStateStore,
    InMemoryHistoryStore,
    InMemoryWorkflowSignalStore,

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
    WorkflowRecoveryService,
  ],
})
export class WorkflowModule {}
