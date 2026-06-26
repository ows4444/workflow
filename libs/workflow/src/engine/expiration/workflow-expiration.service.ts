import { Injectable } from '@nestjs/common';
import { WorkflowStateService } from '../state/service';

@Injectable()
export class WorkflowExpirationService {
  constructor(private readonly stateService: WorkflowStateService) {}

  async expire(workflowId: string): Promise<void> {
    await this.stateService.cancel(workflowId, true);
  }
}
