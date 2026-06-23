import { WorkflowContext } from './workflow-context';
import { WorkflowStepResult } from './workflow-step-result';

export interface WorkflowStepHandler<TState extends object = object> {
  execute(
    context: WorkflowContext<TState>,
  ): Promise<WorkflowStepResult<TState>>;
}
