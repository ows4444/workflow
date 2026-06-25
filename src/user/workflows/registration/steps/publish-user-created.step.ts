import { Inject } from '@nestjs/common';

import {
  NonRetriableWorkflowError,
  RetriableWorkflowError,
} from '@/workflow/errors';
import { UserCreatedEvent } from '../../../domain/events/user-created.event';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from '../registration.constants';
import { RegistrationState } from '../registration.state';
import { EventPublisher } from '../../../application/events/event-publisher';
import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { Step } from '@/workflow/steps/step.decorator';
import { WorkflowContext } from '@/workflow/types/workflow-context';

@Step({
  workflow: REGISTRATION_WORKFLOW,
  workflowVersion: REGISTRATION_VERSION,
  step: REGISTRATION_STEPS.PUBLISH_USER_CREATED,
})
export class PublishUserCreatedStep implements WorkflowStepHandler<RegistrationState> {
  constructor(
    @Inject(EventPublisher)
    private readonly publisher: EventPublisher,
  ) {}

  async execute(
    context: WorkflowContext<RegistrationState>,
  ): Promise<WorkflowStepResult<RegistrationState>> {
    if (!context.data.userId) {
      throw new NonRetriableWorkflowError(
        'User id missing from workflow state',
      );
    }

    try {
      await this.publisher.publish(
        new UserCreatedEvent(context.data.userId, context.data.email),
      );

      return {};
    } catch (error) {
      throw new RetriableWorkflowError(
        `Failed to publish user created event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
