import {
  Step,
  WorkflowContext,
  WorkflowStepHandler,
  WorkflowStepResult,
  createWorkflowStepId,
} from '../../../../workflow';

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
