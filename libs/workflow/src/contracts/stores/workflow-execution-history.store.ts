import { WorkflowStepExecution } from '../workflow-step-execution';

export interface WorkflowExecutionHistoryStore {
  append(workflowId: string, execution: WorkflowStepExecution): Promise<void>;

  findByWorkflowId(
    workflowId: string,
  ): Promise<readonly WorkflowStepExecution[]>;
}
