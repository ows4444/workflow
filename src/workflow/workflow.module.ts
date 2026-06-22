import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { WorkflowRegistry } from './services/workflow.registry';
import { WorkflowDiscovery } from './services/workflow.discovery';
import { WorkflowDefinitionValidator } from './services/workflow-definition.validator';
import { WorkflowStepResolver } from './services/workflow-step-resolver';
import { WorkflowExecutor } from './services/workflow.executor';
import { InMemoryWorkflowStateStore } from './services/in-memory-workflow-state.store';
import { WORKFLOW_STATE_STORE } from './constants/workflow.tokens';
import { WorkflowStateTransitions } from './services/workflow-state.transitions';
import { WorkflowRecoveryService } from './services/workflow-recovery.service';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WorkflowStateTransitions,
    WorkflowRegistry,
    WorkflowDiscovery,
    WorkflowDefinitionValidator,
    WorkflowStepResolver,
    WorkflowExecutor,
    WorkflowRecoveryService,
    InMemoryWorkflowStateStore,
    {
      provide: WORKFLOW_STATE_STORE,
      useExisting: InMemoryWorkflowStateStore,
    },
  ],
  exports: [
    WorkflowRegistry,
    WorkflowStepResolver,
    WorkflowExecutor,
    WORKFLOW_STATE_STORE,
    WorkflowRecoveryService,
  ],
})
export class WorkflowModule {}
