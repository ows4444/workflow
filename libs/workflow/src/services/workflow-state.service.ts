import { Inject, Injectable } from '@nestjs/common';

import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { type WorkflowStateStore } from '../contracts/stores/workflow-state-store';

import { WorkflowStateValidator } from './workflow-state.validator';
import { WorkflowExecutionError } from '../errors/workflow.errors';
import { WorkflowRegistry } from './workflow.registry';
import { WorkflowLifecyclePublisher } from './workflow-lifecycle.publisher';

@Injectable()
export class WorkflowStateService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,

    private readonly validator: WorkflowStateValidator,
    private readonly registry: WorkflowRegistry,
    private readonly publisher: WorkflowLifecyclePublisher,
  ) {}

  async insert(state: WorkflowExecutionState): Promise<void> {
    this.validator.validate(state);

    await this.store.insert(state);
  }

  async load(workflowId: string): Promise<WorkflowExecutionState | null> {
    return this.store.load(workflowId);
  }

  async cancel(workflowId: string): Promise<WorkflowExecutionState> {
    const state = await this.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    const cancelled = { ...state };

    const persisted = await this.save(state, cancelled);

    const workflow = this.registry.get(
      persisted.workflowName,
      persisted.workflowVersion,
    );

    await this.publisher.cancelled(workflow, persisted);

    return persisted;
  }

  async save(
    previous: WorkflowExecutionState,
    next: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    const versioned = { ...next };

    this.validator.validate(versioned);

    return this.store.save(previous, versioned);
  }

  async delete(workflowId: string): Promise<void> {
    await this.store.delete(workflowId);
  }

  async findRunning(): Promise<WorkflowExecutionState[]> {
    return (await this.store.findRunning?.()) ?? [];
  }

  async findWaiting(): Promise<WorkflowExecutionState[]> {
    return (await this.store.findWaiting?.()) ?? [];
  }

  async findFailed(): Promise<WorkflowExecutionState[]> {
    return (await this.store.findFailed?.()) ?? [];
  }

  async findStuck(olderThanMs: number): Promise<WorkflowExecutionState[]> {
    return (await this.store.findStuck?.(olderThanMs)) ?? [];
  }

  async deleteCompleted(olderThanMs?: number): Promise<number> {
    return (await this.store.deleteCompleted?.(olderThanMs)) ?? 0;
  }
}
