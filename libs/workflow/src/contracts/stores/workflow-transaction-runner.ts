export interface WorkflowTransactionRunner {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
