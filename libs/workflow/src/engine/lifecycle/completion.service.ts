import { Inject, Injectable } from '@nestjs/common';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowLifecyclePublisher } from './lifecycle.publisher';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { type WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';

@Injectable()
export class WorkflowCompletionService {
  constructor(
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,

    private readonly registry: WorkflowRegistry,
    private readonly publisher: WorkflowLifecyclePublisher,

    @Inject(WORKFLOW_TRANSACTION_RUNNER)
    private readonly transactionRunner: WorkflowTransactionRunner,
  ) {}

  async completeIfFinished(state: WorkflowExecutionState): Promise<{
    state: WorkflowExecutionState;
    completed: boolean;
  }> {
    if (state.status !== 'running' || state.currentStep !== undefined) {
      return {
        state,
        completed: false,
      };
    }

    const next = this.transitions.completeWorkflow(state);

    const persisted = await this.stateService.save(state, next);

    const workflow = this.registry.get(
      persisted.workflowName,
      persisted.workflowVersion,
    );

    this.transactionRunner.afterCommit?.(() =>
      this.publisher.completed(workflow, persisted),
    );

    return {
      state: persisted,
      completed: true,
    };
  }
}
