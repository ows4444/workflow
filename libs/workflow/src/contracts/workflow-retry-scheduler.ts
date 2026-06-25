export interface WorkflowRetryScheduler {
  wait(delayMs: number, attempt: number): Promise<void>;
}
