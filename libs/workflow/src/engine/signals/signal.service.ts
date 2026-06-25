import { Inject, Injectable } from '@nestjs/common';

import { WORKFLOW_SIGNAL_STORE } from '../../constants/workflow.tokens';
import { type WorkflowSignalStore } from '../../ports/workflow-signal.store';
import { WorkflowSignal } from '@/workflow/models/workflow-signal';

@Injectable()
export class WorkflowSignalService {
  constructor(
    @Inject(WORKFLOW_SIGNAL_STORE)
    private readonly store: WorkflowSignalStore,
  ) {}

  async load(signalId: string) {
    return this.store.load(signalId);
  }

  async exists(signalId: string): Promise<boolean> {
    return this.store.exists(signalId);
  }

  async append(workflowId: string, signal: WorkflowSignal): Promise<boolean> {
    const existing = await this.store.load(signal.signalId);

    if (existing) {
      return false;
    }

    await this.store.insert({
      signalId: signal.signalId,
      workflowId,
      signal,
      processed: false,
      createdAt: new Date(),
    });

    return true;
  }

  async markProcessed(signalId: string): Promise<void> {
    await this.store.markProcessed(signalId);
  }

  async pending(workflowId: string) {
    return this.store.findPending(workflowId);
  }

  async deleteByWorkflowId(workflowId: string): Promise<void> {
    await this.store.deleteByWorkflowId(workflowId);
  }
}
