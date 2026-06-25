import { createWorkflowStepId } from '@/workflow/models/workflow-step-id';

export const REGISTRATION_WORKFLOW = 'user-registration';

export const REGISTRATION_VERSION = 1;

export const REGISTRATION_STEPS = {
  VALIDATE_INPUT: createWorkflowStepId('user-registration.validate-input'),

  CHECK_EXISTING_USER: createWorkflowStepId(
    'user-registration.check-existing-user',
  ),

  CREATE_USER: createWorkflowStepId('user-registration.create-user'),

  SEND_VERIFICATION_EMAIL: createWorkflowStepId(
    'user-registration.send-verification-email',
  ),

  ACTIVATE_USER: createWorkflowStepId('user-registration.activate-user'),

  PUBLISH_USER_CREATED: createWorkflowStepId(
    'user-registration.publish-user-created',
  ),
} as const;

export const REGISTRATION_SIGNALS = {
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
} as const;
