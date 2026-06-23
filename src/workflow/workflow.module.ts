import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { WorkflowRegistry } from './services/workflow.registry';
import { WorkflowDiscovery } from './services/workflow.discovery';
import { WorkflowDefinitionValidator } from './services/workflow-definition.validator';
import { WorkflowStepResolver } from './services/workflow-step-resolver';
import { WorkflowExecutor } from './services/workflow.executor';
import { InMemoryWorkflowStateStore } from './services/in-memory-workflow-state.store';
import {
  WORKFLOW_HISTORY_STORE,
  WORKFLOW_IDEMPOTENCY_STORE,
  WORKFLOW_STATE_STORE,
} from './constants/workflow.tokens';
import { WorkflowStateTransitions } from './services/workflow-state.transitions';
import { WorkflowRecoveryService } from './services/workflow-recovery.service';
import { WorkflowStateValidator } from './services/workflow-state.validator';
import { InMemoryIdempotencyStore } from './services/in-memory-idempotency.store';
import { WorkflowHistoryService } from './services/workflow-history.service';
import { InMemoryHistoryStore } from './services/in-memory-history.store';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WorkflowStateTransitions,
    WorkflowStateValidator,
    WorkflowRegistry,
    WorkflowDiscovery,
    WorkflowDefinitionValidator,
    WorkflowStepResolver,
    WorkflowExecutor,
    WorkflowRecoveryService,
    WorkflowHistoryService,

    InMemoryIdempotencyStore,
    InMemoryWorkflowStateStore,
    InMemoryHistoryStore,

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
  ],
  exports: [
    WorkflowRegistry,
    WorkflowStepResolver,
    WorkflowExecutor,
    WORKFLOW_IDEMPOTENCY_STORE,
    WORKFLOW_STATE_STORE,
    WORKFLOW_HISTORY_STORE,
    WorkflowRecoveryService,
  ],
})
export class WorkflowModule {}
