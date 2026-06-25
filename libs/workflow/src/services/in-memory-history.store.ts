import { Injectable } from '@nestjs/common';

import { WorkflowExecutionHistoryStore } from '../contracts/stores/workflow-execution-history.store';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';

@Injectable()
export class InMemoryHistoryStore implements WorkflowExecutionHistoryStore {
  private readonly executions = new Map<string, WorkflowStepExecution[]>();

  async append(
    workflowId: string,
    execution: WorkflowStepExecution,
  ): Promise<void> {
    const history = this.executions.get(workflowId) ?? [];

    history.push(execution);

    this.executions.set(workflowId, history);
  }

  async findByWorkflowId(
    workflowId: string,
  ): Promise<readonly WorkflowStepExecution[]> {
    return this.executions.get(workflowId) ?? [];
  }

  async delete(workflowId: string): Promise<void> {
    this.executions.delete(workflowId);
  }
}
