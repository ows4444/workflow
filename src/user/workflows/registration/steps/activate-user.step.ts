import { Inject } from '@nestjs/common';

import {
  NonRetriableWorkflowError,
  RetriableWorkflowError,
} from '@/workflow/errors';
import { UserRepository } from '../../../domain/repositories/user.repository';
import {
  REGISTRATION_SIGNALS,
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';
import { EmailVerifiedSignalPayload } from '../registration.signals';
import { RegistrationState } from '../registration.state';
import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { Step } from '@/workflow/steps/step.decorator';
import { WorkflowContext } from '@/workflow/types/workflow-context';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.ACTIVATE_USER,
})
export class ActivateUserStep implements WorkflowStepHandler<RegistrationState> {
  constructor(
    @Inject(UserRepository)
    private readonly users: UserRepository,
  ) {}

  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    if (context.signal?.name !== REGISTRATION_SIGNALS.EMAIL_VERIFIED) {
      throw new NonRetriableWorkflowError('EMAIL_VERIFIED signal is required');
    }

    if (!context.data.userId) {
      throw new NonRetriableWorkflowError(
        'User id not found in workflow state',
      );
    }

    const payload = context.signal.payload as EmailVerifiedSignalPayload;

    try {
      await this.users.activate(context.data.userId);

      return {
        data: {
          emailVerifiedAt: payload.verifiedAt,
          registrationCompleted: true,
        },

        nextStep: REGISTRATION_STEPS.PUBLISH_USER_CREATED,
      };
    } catch (error) {
      throw new RetriableWorkflowError(
        `Failed to activate user: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
