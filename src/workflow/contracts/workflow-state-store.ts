import { WorkflowExecutionState } from './workflow-execution-state';

export interface WorkflowStateStore {
  save(state: WorkflowExecutionState, expectedVersion?: number): Promise<void>;

  load(workflowId: string): Promise<WorkflowExecutionState | null>;

  findRunning?(): Promise<WorkflowExecutionState[]>;

  findWaiting?(): Promise<WorkflowExecutionState[]>;

  findFailed?(): Promise<WorkflowExecutionState[]>;

  findStuck?(olderThanMs: number): Promise<WorkflowExecutionState[]>;

  delete(workflowId: string): Promise<void>;

  deleteCompleted?(olderThanMs?: number): Promise<number>;
}
