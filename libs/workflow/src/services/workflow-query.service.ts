import { Injectable } from '@nestjs/common';

import { WorkflowExecutionError } from '../errors/workflow.errors';

import { WorkflowStateService } from './workflow-state.service';
import { WorkflowHistoryService } from './workflow-history.service';
import { WorkflowSignalService } from './workflow-signal.service';

import { WorkflowDetails } from '../contracts/workflow-details';

@Injectable()
export class WorkflowQueryService {
  constructor(
    private readonly stateService: WorkflowStateService,
    private readonly historyService: WorkflowHistoryService,
    private readonly signalService: WorkflowSignalService,
  ) {}

  async get(workflowId: string): Promise<WorkflowDetails> {
    const state = await this.stateService.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    const [history, pendingSignals] = await Promise.all([
      this.historyService.findByWorkflowId(workflowId),
      this.signalService.pending(workflowId),
    ]);

    return {
      state,
      history,
      pendingSignals,
    };
  }

  async exists(workflowId: string): Promise<boolean> {
    return (await this.stateService.load(workflowId)) !== null;
  }

  async running() {
    return this.stateService.findRunning();
  }

  async waiting() {
    return this.stateService.findWaiting();
  }

  async failed() {
    return this.stateService.findFailed();
  }
}
