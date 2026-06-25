import { Injectable } from '@nestjs/common';

import { WorkflowIdempotencyStore } from '../contracts/stores/workflow-idempotency-store';

interface Entry {
  workflowId: string;
  completed: boolean;
}

@Injectable()
export class InMemoryIdempotencyStore implements WorkflowIdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  async acquire(key: string, workflowId: string): Promise<boolean> {
    if (this.entries.has(key)) {
      return false;
    }

    this.entries.set(key, {
      workflowId,
      completed: false,
    });

    return true;
  }

  async exists(key: string): Promise<boolean> {
    return this.entries.has(key);
  }

  async markCompleted(key: string, workflowId: string): Promise<void> {
    const existing = this.entries.get(key);

    if (!existing) {
      return;
    }

    this.entries.set(key, {
      workflowId,
      completed: true,
    });
  }

  async deleteByWorkflowId(workflowId: string): Promise<void> {
    for (const [key, entry] of this.entries) {
      if (entry.workflowId === workflowId) {
        this.entries.delete(key);
      }
    }
  }
}
