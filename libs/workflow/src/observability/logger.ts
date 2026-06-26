import { Inject, Injectable, Logger } from '@nestjs/common';
import { WORKFLOW_METRICS } from '../constants/workflow.tokens';
import { WorkflowExecutionState } from '../models/workflow-execution-state';
import { type WorkflowMetrics } from '../models/workflow-metrics';
import { WorkflowStepExecution } from '../models/workflow-step-execution';

@Injectable()
export class WorkflowLogger {
  constructor(
    @Inject(WORKFLOW_METRICS)
    private readonly metrics: WorkflowMetrics,
  ) {}

  private readonly logger = new Logger('Workflow');

  started(state: WorkflowExecutionState): void {
    this.logger.log(
      `Started workflow=${state.workflowName} workflowId=${state.workflowId} executionId=${state.executionId}`,
    );
    this.metrics.workflowStarted(state.workflowName);
  }

  deprecatedStep(
    workflowName: string,
    step: string,
    replacement?: string,
  ): void {
    this.logger.warn(
      replacement
        ? `Workflow '${workflowName}' executed deprecated step '${step}'. Replacement: '${replacement}'.`
        : `Workflow '${workflowName}' executed deprecated step '${step}'.`,
    );
  }

  completed(state: WorkflowExecutionState): void {
    this.logger.log(
      `Completed workflow=${state.workflowName} workflowId=${state.workflowId}`,
    );
    this.metrics.workflowCompleted(state.workflowName);
  }

  failed(state: WorkflowExecutionState, error: unknown): void {
    this.logger.error(
      `Failed workflow=${state.workflowName} workflowId=${state.workflowId}`,
      error instanceof Error ? error.stack : String(error),
    );
    this.metrics.workflowFailed(state.workflowName);
  }

  recovered(state: WorkflowExecutionState): void {
    this.logger.log(
      `Recovered workflow=${state.workflowName} workflowId=${state.workflowId}`,
    );

    this.metrics.workflowRecovered(state.workflowName);
  }

  stepStarted(state: WorkflowExecutionState): void {
    this.logger.debug(
      `Step started workflowId=${state.workflowId} step=${state.currentStep}`,
    );
    this.metrics.stepStarted(state.workflowName, state.currentStep!);
  }

  stepCompleted(
    state: WorkflowExecutionState,
    execution: WorkflowStepExecution,
  ): void {
    this.logger.debug(
      `Step completed workflowId=${state.workflowId} step=${execution.step} duration=${execution.durationMs ?? 0}ms`,
    );
    this.metrics.stepCompleted(
      state.workflowName,
      execution.step,
      execution.durationMs ?? 0,
    );
  }

  cancelled(state: WorkflowExecutionState): void {
    this.logger.log(
      `Cancelled workflow=${state.workflowName} workflowId=${state.workflowId}`,
    );

    this.metrics.workflowCancelled(state.workflowName);
  }

  signalReceived(
    workflowName: string,
    workflowId: string,
    signalName: string,
    signalId: string,
  ): void {
    this.logger.debug(
      `Signal received workflowId=${workflowId} signal=${signalName} signalId=${signalId}`,
    );
    this.metrics.signalReceived(workflowName);
  }

  retryScheduled(state: WorkflowExecutionState, retryAt: Date): void {
    this.logger.debug(
      `Retry scheduled workflow=${state.workflowName} workflowId=${state.workflowId} retryAt=${retryAt.toISOString()}`,
    );

    this.metrics.retryScheduled(state.workflowName);
  }
}
