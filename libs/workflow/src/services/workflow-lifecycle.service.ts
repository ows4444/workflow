import { Inject, Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowRegistry } from './workflow.registry';
import { WorkflowStateFactory } from './workflow-state.factory';
import { WorkflowStateService } from './workflow-state.service';

import { WorkflowExecutionError } from '../errors/workflow.errors';
import { WorkflowLifecyclePublisher } from './workflow-lifecycle.publisher';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { type WorkflowTransactionRunner } from '../contracts/stores/workflow-transaction-runner';
import { WORKFLOW_TRANSACTION_RUNNER } from '../constants/workflow.tokens';
import { WorkflowLogger } from './workflow-logger.service';

@Injectable()
export class WorkflowLifecycleService {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly stateFactory: WorkflowStateFactory,
    private readonly stateService: WorkflowStateService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly publisher: WorkflowLifecyclePublisher,
    private readonly logger: WorkflowLogger,

    @Inject(WORKFLOW_TRANSACTION_RUNNER)
    private readonly transactionRunner: WorkflowTransactionRunner,
  ) {}

  async create(
    workflowName: string,
    initialData: Record<string, unknown>,
  ): Promise<{
    workflow: RegisteredWorkflow;
    state: WorkflowExecutionState;
  }> {
    const workflow = this.registry.getLatest(workflowName);

    const state = this.stateFactory.create(workflow, initialData);

    await this.stateService.insert(state);
    this.logger.started(state);

    this.transactionRunner.afterCommit?.(() =>
      this.publisher.started(workflow, state),
    );

    return {
      workflow,
      state,
    };
  }

  async resume(workflowId: string): Promise<{
    workflow: RegisteredWorkflow;
    state: WorkflowExecutionState;
  }> {
    const state = await this.stateService.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.status === 'waiting') {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is waiting for a signal`,
      );
    }

    if (state.status !== 'running') {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' cannot be resumed from status '${state.status}'`,
      );
    }

    const workflow = this.registry.get(
      state.workflowName,
      state.workflowVersion,
    );

    const resumed = state.requiresRecovery
      ? await this.stateService.save(
          state,
          this.transitions.clearRecovery(state),
        )
      : state;

    return {
      workflow,
      state: resumed,
    };
  }
}
