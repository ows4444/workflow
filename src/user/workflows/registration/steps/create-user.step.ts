import { Inject } from '@nestjs/common';
import {
  Step,
  WorkflowContext,
  WorkflowStepHandler,
  WorkflowStepResult,
} from '@/workflow';
import { RetriableWorkflowError } from '@/workflow/errors';
import { UserRepository } from '../../../domain/repositories/user.repository';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';
import { RegistrationState } from '../registration.state';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.CREATE_USER,
})
export class CreateUserStep implements WorkflowStepHandler<RegistrationState> {
  constructor(
    @Inject(UserRepository)
    private readonly users: UserRepository,
  ) {}

  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    try {
      const user = await this.users.create({
        email: context.data.email,
      });

      return {
        data: { userId: user.id },
        nextStep: REGISTRATION_STEPS.SEND_VERIFICATION_EMAIL,
      };
    } catch (error) {
      throw new RetriableWorkflowError(
        `Failed to create user: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
