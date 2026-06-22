import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowStateEntity } from './entities/workflow-state.entity';
import { TypeOrmWorkflowStateStore } from './stores/typeorm-workflow-state.store';

import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowStateEntity])],
  providers: [
    TypeOrmWorkflowStateStore,
    {
      provide: WORKFLOW_STATE_STORE,
      useExisting: TypeOrmWorkflowStateStore,
    },
  ],
  exports: [WORKFLOW_STATE_STORE],
})
export class WorkflowPersistenceModule {}
