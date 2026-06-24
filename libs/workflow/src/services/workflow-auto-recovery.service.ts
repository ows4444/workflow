import { Injectable } from '@nestjs/common';
import { WorkflowRecoveryService } from './workflow-recovery.service';
import { WorkflowExecutor } from './workflow.executor';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class WorkflowAutoRecoveryService {
  constructor(
    private readonly recovery: WorkflowRecoveryService,
    private readonly executor: WorkflowExecutor,
  ) {}

  @Interval(30000)
  async recover(): Promise<void> {
    const recoverable = await this.recovery.findRecoverableExecutions();

    for (const workflow of recoverable) {
      try {
        await this.executor.resume(workflow.workflowId);
      } catch {
        // individual workflow failure must not abort the recovery batch
      }
    }
    const stuck = await this.recovery.findStuckExecutions();

    for (const workflow of stuck) {
      try {
        await this.recovery.markAsRecoverable(workflow.workflowId);
      } catch {
        // individual marking failure must not abort the batch
      }
    }
  }
}
