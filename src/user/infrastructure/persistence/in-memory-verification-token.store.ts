import { Injectable } from '@nestjs/common';

import { VerificationTokenStore } from '../../application/tokens/verification-token.store';

@Injectable()
export class InMemoryVerificationTokenStore extends VerificationTokenStore {
  private readonly tokens = new Map<string, string>();

  async save(token: string, workflowId: string): Promise<void> {
    this.tokens.set(token, workflowId);
  }

  async findWorkflowId(token: string): Promise<string | null> {
    return this.tokens.get(token) ?? null;
  }
}
