import { Inject, Injectable } from '@nestjs/common';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowStateFactory } from '../state/factory';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowLifecyclePublisher } from './lifecycle.publisher';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowExecutionError } from '../../errors/workflow.errors';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowLogger } from '../../observability/logger';
import { type WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';

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

    if (state.requiresRecovery) {
      this.logger.recovered(resumed);
    }

    return {
      workflow,
      state: resumed,
    };
  }
}
