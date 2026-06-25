import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WorkflowStepExecution } from '../contracts/workflow-step-execution';
import { WorkflowStepResult } from '../contracts/workflow-step-result';

import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';

@Injectable()
export class WorkflowStepPersistenceService {
  constructor(
    private readonly history: WorkflowHistoryService,
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
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
}
