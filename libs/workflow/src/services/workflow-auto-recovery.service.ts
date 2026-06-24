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
    const stuck = await this.recovery.findStuckExecutions();

    for (const workflow of stuck) {
      await this.recovery.markAsRecoverable(workflow.workflowId);
    }
  }
}
