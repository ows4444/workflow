import { Injectable } from '@nestjs/common';

import { WorkflowExecutionState } from '../contracts/workflow-execution-state';

import { WorkflowStateTransitions } from './workflow-state.transitions';
import { WorkflowStateService } from './workflow-state.service';

@Injectable()
export class WorkflowCompletionService {
  constructor(
    private readonly transitions: WorkflowStateTransitions,
    private readonly stateService: WorkflowStateService,
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

    return {
      state: await this.stateService.save(state, next),
      completed: true,
    };
  }
}
