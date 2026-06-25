import { WORKFLOW_METRICS } from '@/workflow/constants/workflow.tokens';
import { WorkflowExecutionState } from '@/workflow/models/workflow-execution-state';
import { WorkflowHook } from '@/workflow/models/workflow-hook';
import { type WorkflowMetrics } from '@/workflow/models/workflow-metrics';
import { Inject, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class WorkflowHookExecutor {
  private readonly logger = new Logger(WorkflowHookExecutor.name);
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(WORKFLOW_METRICS)
    private readonly metrics: WorkflowMetrics,
  ) {}

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
      this.metrics.hookFailed(state.workflowName, hook.name);
      this.logger.error(
        `Workflow hook '${hook.name}' failed for workflow '${state.workflowName}' (${state.workflowId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
