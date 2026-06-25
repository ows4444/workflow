import { Inject, Injectable } from '@nestjs/common';

import { WorkflowExecutionResult } from '../contracts/workflow-execution-result';
import { WorkflowRegistry } from './workflow.registry';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WORKFLOW_TRANSACTION_RUNNER } from '../constants/workflow.tokens';
import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowFailureService } from './workflow-failure.service';
import { type WorkflowTransactionRunner } from '../contracts/stores/workflow-transaction-runner';
import { WorkflowCompletionService } from './workflow-completion.service';
import { WorkflowSignalProcessor } from './workflow-signal.processor';
import { WorkflowLifecycleService } from './workflow-lifecycle.service';
import { WorkflowRunner } from './workflow-runner.service';
import { WorkflowLifecyclePublisher } from './workflow-lifecycle.publisher';
import { WorkflowLeaseService } from './workflow-lease.service';
import { WorkflowLogger } from './workflow-logger.service';

@Injectable()
export class WorkflowExecutor {
  constructor(
    private readonly registry: WorkflowRegistry,

    private readonly signalProcessor: WorkflowSignalProcessor,
    private readonly completionService: WorkflowCompletionService,
    private readonly publisher: WorkflowLifecyclePublisher,
    private readonly logger: WorkflowLogger,
    private readonly lifecycle: WorkflowLifecycleService,
    private readonly runner: WorkflowRunner,

    @Inject(WORKFLOW_TRANSACTION_RUNNER)
    private readonly transactionRunner: WorkflowTransactionRunner,

    private readonly leaseService: WorkflowLeaseService,

    private readonly stateService: WorkflowStateService,
    private readonly failureService: WorkflowFailureService,
  ) {}

  private toResult(state: WorkflowExecutionState): WorkflowExecutionResult {
    return {
      workflowId: state.workflowId,
      status: state.status,
      iteration: state.iteration,
      currentStep: state.currentStep,
      data: state.data,
    };
  }

  private async finalize(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<WorkflowExecutionResult> {
    const latest = (await this.stateService.load(state.workflowId)) ?? state;

    const { state: finalState } =
      await this.completionService.completeIfFinished(latest);

    return this.toResult(finalState);
  }

  async resume(workflowId: string): Promise<WorkflowExecutionResult> {
    await this.leaseService.acquire(workflowId);

    try {
      return await this.transactionRunner.execute(async () => {
        const { workflow, state } = await this.lifecycle.resume(workflowId);

        let finalState: WorkflowExecutionState;

        try {
          finalState = await this.runner.run(workflow, state);
        } catch (error) {
          const reloadedState =
            (await this.stateService.load(workflowId)) ?? state;
          await this.failureService.failExecution(reloadedState, error);
          throw error;
        }

        return this.finalize(workflow, finalState);
      });
    } finally {
      await this.leaseService.release(workflowId);
    }
  }

  async execute(
    workflowName: string,
    initialData: Record<string, unknown> = {},
  ): Promise<WorkflowExecutionResult> {
    return this.transactionRunner.execute(async () => {
      const { workflow, state: initialState } = await this.lifecycle.create(
        workflowName,
        initialData,
      );

      await this.leaseService.acquire(initialState.workflowId);

      try {
        let state = initialState;

        try {
          state = await this.runner.run(workflow, state);
        } catch (error) {
          const reloadedState =
            (await this.stateService.load(state.workflowId)) ?? state;
          await this.failureService.handleFailure(reloadedState, error);
          throw error;
        }

        return this.finalize(workflow, state);
      } finally {
        await this.leaseService.release(initialState.workflowId);
      }
    });
  }

  async cancel(
    workflowId: string,
    expired = false,
  ): Promise<WorkflowExecutionResult> {
    return this.transactionRunner.execute(async () => {
      const state = await this.stateService.cancel(workflowId, expired);
      return this.toResult(state);
    });
  }

  async signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    this.logger.signalReceived(workflowId, signal.name, signal.signalId);

    await this.leaseService.acquire(workflowId);

    try {
      return await this.transactionRunner.execute(async () => {
        const state = await this.signalProcessor.prepare(workflowId, signal);

        const workflow = this.registry.get(
          state.workflowName,
          state.workflowVersion,
        );

        let finalState: WorkflowExecutionState | undefined;

        try {
          finalState = await this.runner.run(workflow, state, signal);
        } catch (error) {
          const latest =
            (await this.stateService.load(workflowId)) ?? finalState ?? state;
          await this.failureService.handleFailure(latest, error);

          throw error;
        }

        await this.signalProcessor.complete(workflowId, signal.signalId);

        this.transactionRunner.afterCommit?.(() =>
          this.publisher.signalled(workflow, finalState),
        );

        return this.finalize(workflow, finalState);
      });
    } finally {
      await this.leaseService.release(workflowId);
    }
  }
}
