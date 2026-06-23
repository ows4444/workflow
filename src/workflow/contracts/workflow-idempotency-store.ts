export interface WorkflowIdempotencyStore {
  exists(key: string): Promise<boolean>;

  markCompleted(key: string, workflowId: string): Promise<void>;
}
