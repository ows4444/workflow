import { Injectable } from '@nestjs/common';

import { WorkflowRetryJitter } from '../contracts/workflow-retry-jitter';

@Injectable()
export class DefaultWorkflowRetryJitterService implements WorkflowRetryJitter {
  apply(baseDelayMs: number): number {
    return baseDelayMs;
  }
}
