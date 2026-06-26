import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { WorkflowExecutor } from '../executor/executor';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowRecoveryService } from './recovery.service';
import { DEFAULT_STUCK_THRESHOLD_MS } from '../../constants/workflow.constants';

@Injectable()
export class WorkflowAutoRecoveryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly timerName = 'workflow-auto-recovery';

  constructor(
    private readonly recovery: WorkflowRecoveryService,
    private readonly executor: WorkflowExecutor,
    private readonly registry: WorkflowRegistry,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervals = this.registry
      .getAll()
      .map((w) => w.metadata.autoResume?.intervalMs)
      .filter((x): x is number => x !== undefined);

    const interval = intervals.length > 0 ? Math.min(...intervals) : 30_000;

    const timer = setInterval(() => {
      void this.recover();
    }, interval);

    this.scheduler.addInterval(this.timerName, timer);
  }

  onModuleDestroy(): void {
    try {
      this.scheduler.deleteInterval(this.timerName);
    } catch {
      // Interval was never registered.
    }
  }

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

      const maxAttempts = definition?.metadata.autoResume?.maxAttempts;

      if (
        maxAttempts !== undefined &&
        (workflow.recoveryAttempts ?? 0) >= maxAttempts
      ) {
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

    const waiting = await this.recovery.findExpiredWaitingExecutions(
      0,
      batchSize,
    );

    const now = Date.now();

    for (const execution of waiting) {
      const definition = workflowMap.get(
        `${execution.workflowName}:${execution.workflowVersion}`,
      );

      const timeout =
        definition?.metadata.signals?.defaultTimeoutMs ??
        DEFAULT_STUCK_THRESHOLD_MS;

      if (
        execution.waitingSince &&
        now - execution.waitingSince.getTime() < timeout
      ) {
        continue;
      }

      try {
        await this.executor.cancel(execution.workflowId, true);
      } catch {
        // individual workflow failure must not abort the batch
      }
    }
  }
}
