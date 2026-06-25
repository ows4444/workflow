import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowHook } from '../contracts/workflow-hook';

@Injectable()
export class WorkflowHookExecutor {
  private readonly logger = new Logger(WorkflowHookExecutor.name);
  constructor(private readonly moduleRef: ModuleRef) {}

  async execute(
    state: WorkflowExecutionState,
    hook?: Type<WorkflowHook>,
  ): Promise<void> {
    if (!hook) {
      return;
    }

    const instance = this.moduleRef.get(hook, {
      strict: false,
    });

    if (!instance) {
      this.logger.warn(`Workflow hook instance not found for ${hook.name}`);
      return;
    }

    try {
      await instance.execute(state);
    } catch (error) {
      this.logger.error(
        `Workflow hook '${hook.name}' failed for workflow '${state.workflowName}' (${state.workflowId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
