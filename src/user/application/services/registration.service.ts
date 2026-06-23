import { Injectable } from '@nestjs/common';
import { WorkflowExecutor } from '../../../workflow';
import {
  REGISTRATION_SIGNALS,
  REGISTRATION_WORKFLOW,
} from '../../workflows/registration/registration.constants';

@Injectable()
export class RegistrationService {
  constructor(private readonly workflowExecutor: WorkflowExecutor) {}

  async register(email: string) {
    return this.workflowExecutor.execute(REGISTRATION_WORKFLOW, {
      email,
    });
  }

  async verifyEmail(workflowId: string, token: string) {
    return this.workflowExecutor.signal(workflowId, {
      name: REGISTRATION_SIGNALS.EMAIL_VERIFIED,
      signalId: token,
      payload: {
        verifiedAt: new Date().toISOString(),
      },
    });
  }
}
