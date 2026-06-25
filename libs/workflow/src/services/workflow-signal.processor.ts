import { Inject, Injectable } from '@nestjs/common';

import { WORKFLOW_IDEMPOTENCY_STORE } from '../constants/workflow.tokens';

import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { type WorkflowIdempotencyStore } from '../contracts/stores/workflow-idempotency-store';

import { WorkflowSignalService } from './workflow-signal.service';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { buildSignalIdempotencyKey } from './workflow-idempotency-key';

import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowSignalProcessor {
  constructor(
    @Inject(WORKFLOW_IDEMPOTENCY_STORE)
    private readonly idempotency: WorkflowIdempotencyStore,

    private readonly signals: WorkflowSignalService,
    private readonly states: WorkflowStateService,
    private readonly transitions: WorkflowStateTransitions,
  ) {}

  async prepare(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionState> {
    const key = buildSignalIdempotencyKey(workflowId, signal.signalId);

    const acquired = await this.idempotency.acquire(key, workflowId);

    if (!acquired) {
      const state = await this.states.load(workflowId);

      if (!state) {
        throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
      }

      return state;
    }

    await this.signals.append(workflowId, signal);

    const state = await this.states.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.status !== 'waiting') {
      return state;
    }

    if (state.waitingForSignal?.name !== signal.name) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is not waiting for '${signal.name}'`,
      );
    }

    const resumed = this.transitions.resumeFromSignal(state);

    return this.states.save(state, resumed);
  }

  async complete(workflowId: string, signalId: string): Promise<void> {
    await this.signals.markProcessed(signalId);

    await this.idempotency.markCompleted(
      buildSignalIdempotencyKey(workflowId, signalId),
      workflowId,
    );
  }
}
