import { NonRetriableWorkflowError } from '../../../../../libs/workflow/src/errors';
import { WorkflowStepHandler } from '../../../../../libs/workflow/src/handlers/workflow-step-handler';
import { WorkflowStepResult } from '../../../../../libs/workflow/src/models/workflow-step-result';
import { Step } from '../../../../../libs/workflow/src/steps/step.decorator';
import { WorkflowContext } from '../../../../../libs/workflow/src/types/workflow-context';
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
