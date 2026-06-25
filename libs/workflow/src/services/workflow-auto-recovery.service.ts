import { Injectable } from '@nestjs/common';
import { WorkflowRecoveryService } from './workflow-recovery.service';
import { WorkflowExecutor } from './workflow.executor';
import { Interval } from '@nestjs/schedule';
import { WorkflowRegistry } from './workflow.registry';
import { DEFAULT_STUCK_THRESHOLD_MS } from '../constants/workflow.constants';

@Injectable()
export class WorkflowAutoRecoveryService {
  constructor(
    private readonly recovery: WorkflowRecoveryService,
    private readonly executor: WorkflowExecutor,
    private readonly registry: WorkflowRegistry,
  ) {}

  @Interval(30000)
  async recover(): Promise<void> {
    const workflows = this.registry.getAll();

    const threshold =
      Math.min(
        ...workflows
          .map((x) => x.metadata.autoResume?.stuckThresholdMs)
          .filter((x): x is number => x !== undefined),
      ) || DEFAULT_STUCK_THRESHOLD_MS;

    const recoverable = await this.recovery.findRecoverableExecutions();

    for (const workflow of recoverable) {
      try {
        await this.executor.resume(workflow.workflowId);
      } catch {
        // individual workflow failure must not abort the recovery batch
      }
    }
    const stuck = await this.recovery.findStuckExecutions(threshold);

    for (const workflow of stuck) {
      try {
        await this.recovery.markAsRecoverable(workflow.workflowId);
      } catch {
        // individual marking failure must not abort the batch
      }
    }
  }
}
