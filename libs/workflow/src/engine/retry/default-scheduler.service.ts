import { WorkflowRetryScheduler } from '@/workflow/models/workflow-retry-scheduler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DefaultWorkflowRetryScheduler implements WorkflowRetryScheduler {
  async wait(delayMs: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, delayMs);

      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(new DOMException('Operation aborted', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
