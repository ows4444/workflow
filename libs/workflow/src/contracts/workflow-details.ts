import { WorkflowExecutionState } from './workflow-execution-state';
import { WorkflowStepExecution } from './workflow-step-execution';
import { WorkflowSignalRecord } from './workflow-signal-record';

export interface WorkflowDetails {
  readonly state: WorkflowExecutionState;

  readonly history: readonly WorkflowStepExecution[];

  readonly pendingSignals: readonly WorkflowSignalRecord[];
}
