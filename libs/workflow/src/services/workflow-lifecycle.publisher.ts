import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowHookExecutor } from './workflow-hook.executor';

@Injectable()
export class WorkflowLifecyclePublisher {
  constructor(private readonly hooks: WorkflowHookExecutor) {}

  async started(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onStart);
  }

  async completed(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onComplete);
  }

  async failed(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onFailure);
  }

  async cancelled(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onCancel);
  }

  async expired(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onExpire);
  }

  async signalled(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    await this.hooks.execute(state, workflow.metadata.hooks?.onSignal);
  }
}
