import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WorkflowRegistry } from '../engine/registry/registry';
import { WorkflowStateService } from '../engine/state/service';

@Injectable()
export class WorkflowRetentionService {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly stateService: WorkflowStateService,
  ) {}

  @Interval(60_000)
  async cleanup(): Promise<void> {
    const ttlMs = Math.min(
      ...this.registry
        .getAll()
        .map((w) => w.metadata.retention?.ttlMs)
        .filter((ttl): ttl is number => ttl !== undefined),
    );

    if (!Number.isFinite(ttlMs)) {
      return;
    }
    const batchSize =
      Math.max(
        ...this.registry
          .getAll()
          .map((w) => w.metadata.retention?.batchSize ?? 0),
      ) || undefined;

    const completed = await this.stateService.findCompleted(
      undefined,
      undefined,
      ttlMs,
      batchSize,
    );

    for (const workflow of completed) {
      try {
        await this.stateService.delete(workflow.workflowId);
      } catch {
        // Individual cleanup failures must not abort the batch.
      }
    }
  }
}
