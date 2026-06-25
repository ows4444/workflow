import { Inject } from '@nestjs/common';

import { UserRepository } from '../../../domain/repositories/user.repository';

import { NonRetriableWorkflowError } from '@/workflow/errors';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';
import { RegistrationState } from '../registration.state';
import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { Step } from '@/workflow/steps/step.decorator';
import { WorkflowContext } from '@/workflow/types/workflow-context';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.CHECK_EXISTING_USER,
})
export class CheckExistingUserStep implements WorkflowStepHandler<RegistrationState> {
  constructor(
    @Inject(UserRepository)
    private readonly users: UserRepository,
  ) {}

  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    const exists = await this.users.existsByEmail(context.data.email);

    if (exists) {
      throw new NonRetriableWorkflowError(
        `User '${context.data.email}' already exists`,
      );
    }

    return {
      nextStep: REGISTRATION_STEPS.CREATE_USER,
    };
  }
}
