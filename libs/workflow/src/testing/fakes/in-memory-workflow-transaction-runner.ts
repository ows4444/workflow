import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';

@Injectable()
export class InMemoryWorkflowTransactionRunner implements WorkflowTransactionRunner {
  private readonly logger = new Logger(InMemoryWorkflowTransactionRunner.name);

  private readonly activeStorage = new AsyncLocalStorage<boolean>();

  private readonly storage = new AsyncLocalStorage<
    Array<() => Promise<void>>
  >();

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.activeStorage.run(true, () =>
      this.storage.run([], async () => {
        const result = await operation();

        const callbacks = [...(this.storage.getStore() ?? [])];

        const failures: unknown[] = [];

        for (const callback of callbacks) {
          try {
            await callback();
          } catch (error) {
            failures.push(error);

            this.logger.error(
              'Workflow afterCommit callback failed',
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
        if (failures.length > 0) {
          this.logger.warn(
            `${failures.length} afterCommit callback(s) failed.`,
          );
        }

        return result;
      }),
    );
  }

  afterCommit(operation: () => Promise<void>): void {
    const callbacks = this.storage.getStore();

    if (!callbacks) {
      throw new Error(
        'afterCommit() must be called inside WorkflowTransactionRunner.execute()',
      );
    }

    callbacks.push(operation);
  }

  isActive(): boolean {
    return this.activeStorage.getStore() === true;
  }
}
