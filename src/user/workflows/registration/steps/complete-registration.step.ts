import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { createWorkflowStepId } from '@/workflow/models/workflow-step-id';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { Step } from '@/workflow/steps/step.decorator';
import { WorkflowContext } from '@/workflow/types/workflow-context';

@Step({
  workflow: 'user-registration',
  workflowVersion: 1,
  step: createWorkflowStepId('user.registration.complete'),
})
export class CompleteRegistrationStep implements WorkflowStepHandler {
  async execute(context: WorkflowContext): Promise<WorkflowStepResult> {
    console.log('Registration completed', context.workflowId);

    return {};
  }
}
