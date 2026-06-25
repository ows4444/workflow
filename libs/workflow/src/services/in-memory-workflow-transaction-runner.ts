import { Injectable } from '@nestjs/common';

import { WorkflowTransactionRunner } from '../contracts/stores/workflow-transaction-runner';

@Injectable()
export class InMemoryWorkflowTransactionRunner implements WorkflowTransactionRunner {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}
