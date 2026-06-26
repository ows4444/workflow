import { Inject, Injectable, Type } from '@nestjs/common';
import { WorkflowHookExecutor } from '../hooks/hook-executor';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowHook } from '@/workflow/models/workflow-hook';
import { WORKFLOW_EVENT_PUBLISHER } from '@/workflow/constants/workflow.tokens';
import {
  WorkflowLifecycleEvent,
  type WorkflowEventPublisher,
} from '@/workflow/ports/workflow-event-publisher';

@Injectable()
export class WorkflowLifecyclePublisher {
  constructor(
    private readonly hooks: WorkflowHookExecutor,
    @Inject(WORKFLOW_EVENT_PUBLISHER)
    private readonly events: WorkflowEventPublisher,
  ) {}

  private publish(
    type: WorkflowLifecycleEvent['type'],
    state: WorkflowExecutionState,
    workflow: RegisteredWorkflow,
    hook?: Type<WorkflowHook>,
  ) {
    void this.events.publish({
      type,
      state,
    });

    return this.hooks.execute(state, hook);
  }

  async started(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'started',
      state,
      workflow,
      workflow.metadata.hooks?.onStart,
    );
  }

  async completed(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'completed',
      state,
      workflow,
      workflow.metadata.hooks?.onComplete,
    );
  }

  async failed(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'failed',
      state,
      workflow,
      workflow.metadata.hooks?.onFailure,
    );
  }

  async cancelled(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'cancelled',
      state,
      workflow,
      workflow.metadata.hooks?.onCancel,
    );
  }

  async expired(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'expired',
      state,
      workflow,
      workflow.metadata.hooks?.onExpire,
    );
  }

  async signalled(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    return this.publish(
      'signalled',
      state,
      workflow,
      workflow.metadata.hooks?.onSignal,
    );
  }
}
