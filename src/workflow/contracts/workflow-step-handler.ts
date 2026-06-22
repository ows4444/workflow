import { WorkflowContext } from './workflow-context';
import { WorkflowStepResult } from './workflow-step-result';

export interface WorkflowStepHandler<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  execute(
    context: WorkflowContext<TState>,
  ): Promise<WorkflowStepResult<TState>>;
}
