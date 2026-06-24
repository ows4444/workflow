import { Inject, Injectable } from '@nestjs/common';

import { WORKFLOW_STATE_STORE } from '../constants/workflow.tokens';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { type WorkflowStateStore } from '../contracts/stores/workflow-state-store';

import { WorkflowExecutionMapper } from '../domain/workflow-execution.mapper';

import { WorkflowStateValidator } from './workflow-state.validator';
import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowStateService {
  constructor(
    @Inject(WORKFLOW_STATE_STORE)
    private readonly store: WorkflowStateStore,

    private readonly validator: WorkflowStateValidator,
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

    const cancelled = WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(state).cancel(),
    );

    return this.save(state, cancelled);
  }

  async save(
    previous: WorkflowExecutionState,
    next: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    const versioned = WorkflowExecutionMapper.toState(
      WorkflowExecutionMapper.fromState(next).bumpVersion(),
    );

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
