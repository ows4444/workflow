import { Inject, Injectable } from '@nestjs/common';

import { type WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowStepExecution } from '../../models/workflow-step-execution';
import { WorkflowStepResult } from '../../models/workflow-step-result';
import { WorkflowHistoryService } from '../../persistence/history.service';

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
    await this.history.append(previous.workflowId, execution);

    const next = this.transitions.completeStep(
      previous,
      execution,
      result.nextStep,
      result.waitForSignal,
      result.data,
    );

    return this.stateService.save(previous, next);
  }

  async appendRetry(
    workflowId: string,
    execution: WorkflowStepExecution,
  ): Promise<void> {
    await this.history.append(workflowId, execution);
  }
}
