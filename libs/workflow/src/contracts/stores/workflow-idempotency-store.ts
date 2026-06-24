export interface WorkflowIdempotencyStore {
  acquire(key: string, workflowId: string): Promise<boolean>;

  exists(key: string): Promise<boolean>;

  markCompleted(key: string, workflowId: string): Promise<void>;
}
