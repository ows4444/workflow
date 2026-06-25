import { WorkflowExecutor } from '@/workflow/engine/executor/executor';
import { WorkflowExecutionResult } from '@/workflow/models/workflow-execution-result';
import { WorkflowSignal } from '@/workflow/models/workflow-signal';
import { WorkflowDetails } from '@/workflow/types/workflow-details';
import { Injectable } from '@nestjs/common';
import { WorkflowQueryService } from './workflow-query.service';

@Injectable()
export class WorkflowClient {
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly query: WorkflowQueryService,
  ) {}

  execute(
    workflowName: string,
    data: Record<string, unknown> = {},
  ): Promise<WorkflowExecutionResult> {
    return this.executor.execute(workflowName, data);
  }

  resume(workflowId: string): Promise<WorkflowExecutionResult> {
    return this.executor.resume(workflowId);
  }

  signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    return this.executor.signal(workflowId, signal);
  }

  cancel(
    workflowId: string,
    expired = false,
  ): Promise<WorkflowExecutionResult> {
    return this.executor.cancel(workflowId, expired);
  }

  get(workflowId: string): Promise<WorkflowDetails> {
    return this.query.get(workflowId);
  }

  exists(workflowId: string): Promise<boolean> {
    return this.query.exists(workflowId);
  }

  running() {
    return this.query.running();
  }

  waiting() {
    return this.query.waiting();
  }

  failed() {
    return this.query.failed();
  }
}
