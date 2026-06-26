import { Injectable } from '@nestjs/common';
import { RegisteredWorkflow } from '../models/registered-workflow';
import { WorkflowExecutionState } from '../models/workflow-execution-state';
import { WorkflowSnapshotStore } from '../ports/workflow-snapshot.store';

@Injectable()
export class NoopWorkflowSnapshotStore implements WorkflowSnapshotStore {
  async load(): Promise<WorkflowExecutionState | null> {
    return null;
  }

  async snapshot(
    _workflow: RegisteredWorkflow,
    _state: WorkflowExecutionState,
  ): Promise<void> {}
}
