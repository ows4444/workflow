import { Injectable } from '@nestjs/common';

import { WorkflowMetrics } from '../contracts/workflow-metrics';

@Injectable()
export class NoopWorkflowMetricsService implements WorkflowMetrics {
  workflowStarted(): void {}

  workflowCompleted(): void {}

  workflowFailed(): void {}

  workflowCancelled(): void {}

  workflowRecovered(): void {}

  signalReceived(): void {}

  retryScheduled(): void {}

  stepStarted(): void {}

  stepCompleted(): void {}
}
