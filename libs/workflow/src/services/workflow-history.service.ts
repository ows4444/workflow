import { Inject, Injectable, Optional } from '@nestjs/common';

import { WORKFLOW_HISTORY_STORE } from '../constants/workflow.tokens';
import { type WorkflowExecutionHistoryStore } from '../contracts/stores/workflow-execution-history.store';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';

@Injectable()
export class WorkflowHistoryService {
  constructor(
    @Optional()
    @Inject(WORKFLOW_HISTORY_STORE)
    private readonly store?: WorkflowExecutionHistoryStore,
  ) {}

  async append(
    workflowId: string,
    execution: WorkflowStepExecution,
  ): Promise<void> {
    await this.store?.append(workflowId, execution);
  }

  async findByWorkflowId(
    workflowId: string,
  ): Promise<readonly WorkflowStepExecution[]> {
    return (await this.store?.findByWorkflowId(workflowId)) ?? [];
  }
}
