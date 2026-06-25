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

    const workflowMap = new Map(
      workflows.map((workflow) => [
        `${workflow.metadata.name}:${workflow.metadata.version}`,
        workflow,
      ]),
    );

    const threshold =
      Math.min(
        ...workflows
          .map((x) => x.metadata.autoResume?.stuckThresholdMs)
          .filter((x): x is number => x !== undefined),
      ) || DEFAULT_STUCK_THRESHOLD_MS;

    const batchSize =
      Math.max(
        ...workflows.map((w) => w.metadata.autoResume?.batchSize ?? 0),
      ) || undefined;

    const recoverable =
      await this.recovery.findRecoverableExecutions(batchSize);

    for (const workflow of recoverable) {
      const definition = workflowMap.get(
        `${workflow.workflowName}:${workflow.workflowVersion}`,
      );

      if (definition?.metadata.autoResume?.enabled === false) {
        continue;
      }

      try {
        await this.executor.resume(workflow.workflowId);
      } catch {
        // individual workflow failure must not abort the recovery batch
      }
    }
    const stuck = await this.recovery.findStuckExecutions(threshold, batchSize);

    for (const workflow of stuck) {
      try {
        await this.recovery.markAsRecoverable(workflow.workflowId);
      } catch {
        // individual marking failure must not abort the batch
      }
    }

    const expired = await this.recovery.findExpiredWaitingExecutions(
      threshold,
      batchSize,
    );

    for (const workflow of expired) {
      try {
        await this.executor.cancel(workflow.workflowId, true);
      } catch {
        // ignore
      }
    }
  }
}
