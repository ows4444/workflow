import { WorkflowExecutionState } from './workflow-execution-state';

export type WorkflowStateUpdate = Partial<
  Omit<
    WorkflowExecutionState,
    | 'workflowId'
    | 'executionId'
    | 'workflowName'
    | 'workflowVersion'
    | 'createdAt'
  >
>;
