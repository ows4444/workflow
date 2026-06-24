import {
  Step,
  WorkflowContext,
  WorkflowStepHandler,
  WorkflowStepResult,
  createWorkflowStepId,
} from '@/workflow';

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
