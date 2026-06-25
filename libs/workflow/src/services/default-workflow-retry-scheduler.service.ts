import { Injectable } from '@nestjs/common';

import { WorkflowRetryScheduler } from '../contracts/workflow-retry-scheduler';

@Injectable()
export class DefaultWorkflowRetryScheduler implements WorkflowRetryScheduler {
  async wait(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
