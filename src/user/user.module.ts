import { Module } from '@nestjs/common';
import { UserController } from './presentation/http/user.controller';
import { RegistrationService } from './application/services/registration.service';

import { UserRepository } from './domain/repositories/user.repository';

import { EventPublisher } from './application/events/event-publisher';

import { VerificationTokenStore } from './application/tokens/verification-token.store';

import { EmailService } from './infrastructure/mail/email.service';

import { InMemoryUserRepository } from './infrastructure/persistence/in-memory-user.repository';

import { InMemoryVerificationTokenStore } from './infrastructure/persistence/in-memory-verification-token.store';

import { ConsoleEmailService } from './infrastructure/mail/console-email.service';

import { ConsoleEventPublisher } from './infrastructure/events/console-event.publisher';

import { CheckExistingUserStep } from './workflows/registration/steps/check-existing-user.step';
import { CreateUserStep } from './workflows/registration/steps/create-user.step';
import { SendVerificationEmailStep } from './workflows/registration/steps/send-verification-email.step';
import { ActivateUserStep } from './workflows/registration/steps/activate-user.step';
import { PublishUserCreatedStep } from './workflows/registration/steps/publish-user-created.step';

import { ValidateInputStep } from './workflows/registration/steps/validate-input.step';
import { UserRegistrationWorkflow } from './workflows/user.registration.workflow';
import { WorkflowModule } from '@/workflow/public/workflow.module';

@Module({
  imports: [WorkflowModule],

  controllers: [UserController],

  providers: [
    RegistrationService,

    UserRegistrationWorkflow,

    ValidateInputStep,
    CheckExistingUserStep,
    CreateUserStep,
    SendVerificationEmailStep,
    ActivateUserStep,
    PublishUserCreatedStep,

    InMemoryUserRepository,
    InMemoryVerificationTokenStore,
    ConsoleEmailService,
    ConsoleEventPublisher,

    {
      provide: UserRepository,
      useExisting: InMemoryUserRepository,
    },

    {
      provide: VerificationTokenStore,
      useExisting: InMemoryVerificationTokenStore,
    },

    {
      provide: EmailService,
      useExisting: ConsoleEmailService,
    },

    {
      provide: EventPublisher,
      useExisting: ConsoleEventPublisher,
    },
  ],

  exports: [UserRepository, VerificationTokenStore],
})
export class UserModule {}
