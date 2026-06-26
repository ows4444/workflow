import { WorkflowExecutionState } from '../models/workflow-execution-state';
import { WorkflowStepExecution } from '../models/workflow-step-execution';
import { WorkflowSignalRecord } from '../models/workflow-signal-record';
import { WorkflowDetails } from '../types/workflow-details';

export interface IWorkflowQueryService {
  get(workflowId: string): Promise<WorkflowDetails>;

  exists(workflowId: string): Promise<boolean>;

  active(workflowName?: string): Promise<WorkflowExecutionState[]>;

  correlation(correlationId: string): Promise<WorkflowExecutionState[]>;

  running(): Promise<WorkflowExecutionState[]>;

  waiting(): Promise<WorkflowExecutionState[]>;

  failed(): Promise<WorkflowExecutionState[]>;
}
