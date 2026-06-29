import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { WORKFLOW_STATE_STORE } from '../../constants/workflow.tokens';
import { WorkflowStateStore } from '../../ports/workflow-state-store';
import { WorkflowConcurrencyError } from '../../errors/workflow.errors';

@Injectable()
export class WorkflowLeaseService {
  private readonly ownerId = randomUUID();

  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,
  ) {}

  async acquire(
    workflowId: string,
    leaseMs = 60_000,
  ): Promise<string | undefined> {
    if (!this.store.acquireLease) {
      return undefined;
    }

    const expiresAt = new Date(Date.now() + leaseMs);

    const acquired = await this.store.acquireLease(
      workflowId,
      this.ownerId,
      expiresAt,
    );

    if (!acquired) {
      throw new WorkflowConcurrencyError(
        `Workflow '${workflowId}' is already leased`,
      );
    }

    return this.ownerId;
  }

  async release(workflowId: string): Promise<void> {
    if (!this.store.releaseLease) {
      return;
    }

    await this.store.releaseLease(workflowId, this.ownerId);
  }

  async renew(workflowId: string, leaseMs = 60_000): Promise<void> {
    if (!this.store.renewLease) {
      return;
    }

    const renewed = await this.store.renewLease(
      workflowId,
      this.ownerId,
      new Date(Date.now() + leaseMs),
    );

    if (!renewed) {
      throw new WorkflowConcurrencyError(
        `Lease lost for workflow '${workflowId}'`,
      );
    }
  }

  keepAlive(workflowId: string, leaseMs = 60_000): () => void {
    const intervalMs = Math.max(1_000, Math.floor(leaseMs / 2));

    const timer = setInterval(() => {
      void this.renew(workflowId, leaseMs).catch(() => {
        clearInterval(timer);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }
}
