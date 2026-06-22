import { WorkflowSignal } from './workflow-signal';
import { WorkflowStepId } from './workflow-step-id';

export interface WorkflowStepResult<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly nextStep?: WorkflowStepId;

  readonly waitForSignal?: WorkflowSignal;

  readonly data?: Partial<TState>;
}
