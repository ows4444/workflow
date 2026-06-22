export interface WorkflowExecutionResult {
  readonly workflowId: string;

  readonly status: 'waiting' | 'completed' | 'failed';

  readonly currentStep?: string;

  readonly iteration: number;

  readonly data: Readonly<Record<string, unknown>>;
}
