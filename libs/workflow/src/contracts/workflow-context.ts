import { WorkflowSignal } from './workflow-signal';

export interface WorkflowContext<TState extends object = object> {
  readonly workflowId: string;
  readonly correlationId?: string;
  readonly stepExecutionKey: string;
  readonly executionId: string;
  readonly workflowName: string;
  readonly currentStep?: string;
  readonly data: Readonly<TState>;
  readonly signal?: WorkflowSignal;
  readonly abortSignal: AbortSignal;
}
