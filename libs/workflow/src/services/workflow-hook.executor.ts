import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowHook } from '../contracts/workflow-hook';

@Injectable()
export class WorkflowHookExecutor {
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
      return;
    }

    await instance.execute(state);
  }
}
