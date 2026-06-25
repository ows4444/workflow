import { Injectable } from '@nestjs/common';

import { WorkflowSignalRecord } from '../contracts/workflow-signal-record';
import { WorkflowSignalStore } from '../contracts/stores/workflow-signal.store';
import { WorkflowConcurrencyError } from '../errors/workflow.errors';

@Injectable()
export class InMemoryWorkflowSignalStore implements WorkflowSignalStore {
  private readonly records = new Map<string, WorkflowSignalRecord>();

  async load(signalId: string): Promise<WorkflowSignalRecord | null> {
    return this.records.get(signalId) ?? null;
  }

  async insert(record: WorkflowSignalRecord): Promise<void> {
    if (this.records.has(record.signalId)) {
      throw new WorkflowConcurrencyError(
        `Signal '${record.signalId}' already exists`,
      );
    }

    this.records.set(record.signalId, record);
  }

  async markProcessed(signalId: string): Promise<void> {
    const existing = this.records.get(signalId);

    if (!existing) {
      return;
    }

    this.records.set(signalId, {
      ...existing,
      processed: true,
      processedAt: new Date(),
    });
  }

  async findPending(
    workflowId: string,
  ): Promise<readonly WorkflowSignalRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.workflowId === workflowId && !record.processed)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async exists(signalId: string): Promise<boolean> {
    return this.records.has(signalId);
  }

  async deleteByWorkflowId(workflowId: string): Promise<void> {
    for (const [signalId, record] of this.records) {
      if (record.workflowId === workflowId) {
        this.records.delete(signalId);
      }
    }
  }
}
