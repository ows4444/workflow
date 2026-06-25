import { Inject, Injectable } from '@nestjs/common';

import { type WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowExecutionState } from '@/workflow/models/workflow-execution-state';
import { WorkflowStepExecution } from '@/workflow/models/workflow-step-execution';
import { WorkflowStepResult } from '@/workflow/models/workflow-step-result';
import { WorkflowHistoryService } from '@/workflow/persistence/history.service';
import { WorkflowStateService } from '../state/service';
import { WorkflowStateTransitions } from '../state/transitions';

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

  async appendRetry(
    workflowId: string,
    execution: WorkflowStepExecution,
  ): Promise<void> {
    await this.history.append(workflowId, execution);
  }
}
