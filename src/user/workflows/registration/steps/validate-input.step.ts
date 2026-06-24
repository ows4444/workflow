import {
  Step,
  WorkflowContext,
  WorkflowStepHandler,
  WorkflowStepResult,
} from '@/workflow';
import { NonRetriableWorkflowError } from '@/workflow/errors';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';

import { type RegistrationState } from '../registration.state';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.VALIDATE_INPUT,
})
export class ValidateInputStep implements WorkflowStepHandler<RegistrationState> {
  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    if (!context.data.email?.trim()) {
      throw new NonRetriableWorkflowError('Email is required');
    }

    return {
      nextStep: REGISTRATION_STEPS.CHECK_EXISTING_USER,
    };
  }
}
