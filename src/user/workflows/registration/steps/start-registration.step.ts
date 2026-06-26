import { WorkflowStepHandler } from '../../../../../libs/workflow/src/handlers/workflow-step-handler';
import { createWorkflowStepId } from '../../../../../libs/workflow/src/models/workflow-step-id';
import { WorkflowStepResult } from '../../../../../libs/workflow/src/models/workflow-step-result';
import { Step } from '../../../../../libs/workflow/src/steps/step.decorator';
import { WorkflowContext } from '../../../../../libs/workflow/src/types/workflow-context';

@Step({
  workflow: 'user-registration',
  workflowVersion: 1,
  step: createWorkflowStepId('user.registration.start'),
})
export class StartRegistrationStep implements WorkflowStepHandler {
  async execute(context: WorkflowContext): Promise<WorkflowStepResult> {
    console.log('Starting registration', context.workflowId);

    return {
      nextStep: createWorkflowStepId('user.registration.complete'),
    };
  }
}
