export interface WorkflowLeaseStore {
  release(workflowId: string): Promise<void>;

  releaseExpired(now: Date): Promise<number>;
}
