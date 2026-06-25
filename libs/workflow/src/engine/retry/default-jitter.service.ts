import { WorkflowRetryJitter } from '@/workflow/models/workflow-retry-jitter';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DefaultWorkflowRetryJitterService implements WorkflowRetryJitter {
  apply(baseDelayMs: number): number {
    return baseDelayMs;
  }
}
