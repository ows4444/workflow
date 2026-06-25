import { Workflow } from '@/workflow/workflow/workflow.decorator';
import {
  REGISTRATION_STEPS,
  REGISTRATION_VERSION,
  REGISTRATION_WORKFLOW,
} from './registration/registration.constants';

@Workflow({
  name: REGISTRATION_WORKFLOW,
  version: REGISTRATION_VERSION,
  description: 'User registration workflow',
  retries: {
    maxAttempts: 3,
    strategy: 'exponential',
    delayMs: 1000,
    maxDelayMs: 30000,
  },

  definition: {
    start: REGISTRATION_STEPS.VALIDATE_INPUT,

    transitions: {
      [REGISTRATION_STEPS.VALIDATE_INPUT]: [
        REGISTRATION_STEPS.CHECK_EXISTING_USER,
      ],

      [REGISTRATION_STEPS.CHECK_EXISTING_USER]: [
        REGISTRATION_STEPS.CREATE_USER,
      ],

      [REGISTRATION_STEPS.CREATE_USER]: [
        REGISTRATION_STEPS.SEND_VERIFICATION_EMAIL,
      ],

      [REGISTRATION_STEPS.SEND_VERIFICATION_EMAIL]: [
        REGISTRATION_STEPS.ACTIVATE_USER,
      ],

      [REGISTRATION_STEPS.ACTIVATE_USER]: [
        REGISTRATION_STEPS.PUBLISH_USER_CREATED,
      ],

      [REGISTRATION_STEPS.PUBLISH_USER_CREATED]: [],
    },
  },
})
export class UserRegistrationWorkflow {}
