import { NonRetriableWorkflowError } from '@/workflow/errors';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';

import { type RegistrationState } from '../registration.state';
import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { Step } from '@/workflow/steps/step.decorator';
import { WorkflowContext } from '@/workflow/types/workflow-context';

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
