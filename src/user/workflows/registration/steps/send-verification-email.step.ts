import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Step,
  WorkflowContext,
  WorkflowStepHandler,
  WorkflowStepResult,
} from '@/workflow';
import { RetriableWorkflowError } from '@/workflow/errors';
import { EmailService } from '../../../infrastructure/mail/email.service';
import {
  REGISTRATION_SIGNALS,
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';
import { RegistrationState } from '../registration.state';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.SEND_VERIFICATION_EMAIL,
})
export class SendVerificationEmailStep implements WorkflowStepHandler<RegistrationState> {
  constructor(
    @Inject(EmailService)
    private readonly emailService: EmailService,
  ) {}

  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    const verificationToken = randomUUID();

    try {
      await this.emailService.sendVerificationEmail(
        context.data.email,
        verificationToken,
      );

      return {
        data: {
          verificationToken,
        },

        nextStep: REGISTRATION_STEPS.ACTIVATE_USER,

        waitForSignal: {
          name: REGISTRATION_SIGNALS.EMAIL_VERIFIED,
          signalId: verificationToken,
        },
      };
    } catch (error) {
      throw new RetriableWorkflowError(
        `Failed to send verification email: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
