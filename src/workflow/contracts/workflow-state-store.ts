import { WorkflowExecutionState } from './workflow-execution-state';

export interface WorkflowStateStore {
  insert(state: WorkflowExecutionState): Promise<void>;

  save(
    previousState: WorkflowExecutionState,
    nextState: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState>;

  load(workflowId: string): Promise<WorkflowExecutionState | null>;

  delete(workflowId: string): Promise<void>;

  findRunning?(): Promise<WorkflowExecutionState[]>;

  findWaiting?(): Promise<WorkflowExecutionState[]>;

  findFailed?(): Promise<WorkflowExecutionState[]>;

  findStuck?(olderThanMs: number): Promise<WorkflowExecutionState[]>;

  deleteCompleted?(olderThanMs?: number): Promise<number>;
}
