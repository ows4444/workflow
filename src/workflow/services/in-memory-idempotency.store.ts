import { Injectable } from '@nestjs/common';

import { WorkflowIdempotencyStore } from '../contracts/workflow-idempotency-store';

@Injectable()
export class InMemoryIdempotencyStore implements WorkflowIdempotencyStore {
  private readonly keys = new Set<string>();

  async exists(key: string): Promise<boolean> {
    return this.keys.has(key);
  }

  async markCompleted(key: string): Promise<void> {
    this.keys.add(key);
  }
}
