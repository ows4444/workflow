import { Inject, Injectable, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WorkflowRegistry } from '../engine/registry/registry';
import { WorkflowStateService } from '../engine/state/service';
import { WorkflowQueryService } from '../public/api/workflow-query.service';
import { WORKFLOW_ARCHIVE_STORE } from '../constants/workflow.tokens';
import { type WorkflowArchiveStore } from '../ports/workflow-archive.store';

@Injectable()
export class WorkflowRetentionService {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly stateService: WorkflowStateService,
    private readonly queryService: WorkflowQueryService,

    @Optional()
    @Inject(WORKFLOW_ARCHIVE_STORE)
    private readonly archiveStore?: WorkflowArchiveStore,
  ) {}

  @Interval(60_000)
  async cleanup(): Promise<void> {
    for (const definition of this.registry.getAll()) {
      const retention = definition.metadata.retention;

      if (!retention) {
        continue;
      }

      const completed = await this.stateService.findCompleted(
        definition.metadata.name,
        definition.metadata.version,
        retention.ttlMs,
        retention.batchSize,
      );

      for (const workflow of completed) {
        try {
          const retention = definition.metadata.retention;

          if (retention?.archiveBeforeDelete) {
            const details = await this.queryService.get(workflow.workflowId);
            await this.archiveStore?.archive(details);
          }

          await this.stateService.delete(workflow.workflowId);
        } catch {
          // Individual cleanup failures must not abort the batch.
        }
      }
    }
  }
}
