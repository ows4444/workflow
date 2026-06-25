import { Inject, Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';
import { WorkflowStepResult } from '../contracts/workflow-step-result';

import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';
import { type WorkflowTransactionRunner } from '../contracts/stores/workflow-transaction-runner';
import { WORKFLOW_TRANSACTION_RUNNER } from '../constants/workflow.tokens';

@Injectable()
export class WorkflowStepPersistenceService {
  constructor(
    private readonly history: WorkflowHistoryService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,

    @Inject(WORKFLOW_TRANSACTION_RUNNER)
    private readonly transactionRunner: WorkflowTransactionRunner,
  ) {}

  async completeStep(
    previous: WorkflowExecutionState,
    execution: WorkflowStepExecution,
    result: WorkflowStepResult,
  ): Promise<WorkflowExecutionState> {
    return this.transactionRunner.execute(async () => {
      await this.history.append(previous.workflowId, execution);

      const next = this.transitions.completeStep(
        previous,
        execution,
        result.nextStep,
        result.waitForSignal,
        result.data,
      );

      return this.stateService.save(previous, next);
    });
  }
}
