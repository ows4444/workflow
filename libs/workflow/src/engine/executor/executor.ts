import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WorkflowCompletionService } from '../lifecycle/completion.service';
import { WorkflowFailureService } from '../lifecycle/failure.service';
import { WorkflowLifecyclePublisher } from '../lifecycle/lifecycle.publisher';
import { WorkflowLifecycleService } from '../lifecycle/lifecycle.service';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowSignalProcessor } from '../signals/signal.processor';
import { WorkflowStateService } from '../state/service';
import { WorkflowRunner } from './runner';
import { WORKFLOW_TRANSACTION_RUNNER } from '../../constants/workflow.tokens';
import { WorkflowLeaseService } from '../../infrastructure/lease/lease.service';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionResult } from '../../models/workflow-execution-result';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowSignal } from '../../models/workflow-signal';
import { WorkflowLogger } from '../../observability/logger';
import { WorkflowTransactionRunner } from '../../ports/workflow-transaction-runner';

export interface WorkflowExecutionOptions {
  readonly correlationId?: string;
  readonly parentWorkflowId?: string;
  readonly parentExecutionId?: string;
}

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
    @Inject(forwardRef(() => WorkflowFailureService))
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
  private async withLease<T>(
    workflowId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    await this.leaseService.acquire(workflowId);

    try {
      return await operation();
    } finally {
      await this.leaseService.release(workflowId);
    }
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
    return this.withLease(workflowId, async () => {
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
    });
  }

  async execute(
    workflowName: string,
    initialData: Record<string, unknown> = {},
    options?: WorkflowExecutionOptions,
  ): Promise<WorkflowExecutionResult> {
    return this.transactionRunner.executeOrJoin!(async () => {
      const { workflow, state: initialState } = await this.lifecycle.create(
        workflowName,
        initialData,
        options,
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
    return this.transactionRunner.executeOrJoin!(async () => {
      const state = await this.stateService.cancel(workflowId, expired);
      return this.toResult(state);
    });
  }

  async signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    let nextSignal: WorkflowSignal | undefined = signal;
    let result: WorkflowExecutionResult | undefined;

    while (nextSignal) {
      result = await this.withLease(workflowId, async () => {
        return this.transactionRunner.executeOrJoin!(async () => {
          const state = await this.signalProcessor.prepare(
            workflowId,
            nextSignal!,
          );

          const workflow = this.getDefinition(
            state.workflowName,
            state.workflowVersion,
          );

          this.logger.signalReceived(
            workflow.metadata.name,
            workflowId,
            signal.name,
            signal.signalId,
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

          this.transactionRunner.afterCommit?.(async () => {
            await this.signalProcessor.complete(workflowId, signal.signalId);

            await this.publisher.signalled(workflow, finalState);
          });

          const result = await this.finalize(workflow, finalState);

          if (result.status !== 'waiting') {
            return result;
          }

          const pending = await this.signalProcessor.pending(workflowId);
          nextSignal = pending[0]?.signal;

          return result;
        });
      });
    }

    return result!;
  }

  async findByParentWorkflowId(parentWorkflowId: string) {
    return this.stateService.findByParentWorkflowId(parentWorkflowId);
  }

  getDefinition(workflowName: string, version?: number): RegisteredWorkflow {
    return version === undefined
      ? this.registry.getLatest(workflowName)
      : this.registry.get(workflowName, version);
  }
}
