import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_MAX_WORKFLOW_ITERATIONS } from '../constants/workflow.constants';
import { WorkflowExecutionResult } from '../contracts/workflow-execution-result';

import { WorkflowExecutionError } from '../errors/workflow.errors';
import { WorkflowRegistry } from './workflow.registry';
import { WorkflowExecutionState } from '../contracts/workflow-execution-state';
import { WORKFLOW_IDEMPOTENCY_STORE } from '../constants/workflow.tokens';
import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowSignal } from '../contracts/workflow-signal';
import { WorkflowStateTransitions } from './workflow-state.transitions';

import { WorkflowStateFactory } from './workflow-state.factory';

import { type WorkflowIdempotencyStore } from '../contracts/stores/workflow-idempotency-store';
import { WorkflowHistoryService } from './workflow-history.service';

import { buildSignalIdempotencyKey } from './workflow-idempotency-key';
import { WorkflowSignalService } from './workflow-signal.service';
import { WorkflowStateService } from './workflow-state.service';
import { WorkflowExecutionMapper } from '../domain/workflow-execution.mapper';
import { WorkflowStepExecutor } from './workflow-step.executor';
import { WorkflowFailureService } from './workflow-failure.service';
import { WorkflowStateValidator } from './workflow-state.validator';

@Injectable()
export class WorkflowExecutor {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly stepExecutor: WorkflowStepExecutor,
    private readonly transitions: WorkflowStateTransitions,
    private readonly history: WorkflowHistoryService,
    private readonly signals: WorkflowSignalService,

    @Inject(WORKFLOW_IDEMPOTENCY_STORE)
    private readonly idempotencyStore: WorkflowIdempotencyStore,

    private readonly stateFactory: WorkflowStateFactory,

    private readonly stateService: WorkflowStateService,
    private readonly stateValidator: WorkflowStateValidator,
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

  private async run(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
    signal?: WorkflowSignal,
  ): Promise<WorkflowExecutionState> {
    let pendingSignal: WorkflowSignal | undefined = signal;

    while (state.currentStep !== undefined) {
      const currentStep = state.currentStep;

      if (state.iteration >= DEFAULT_MAX_WORKFLOW_ITERATIONS) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowName}' exceeded max iterations`,
        );
      }

      const step = workflow.steps.get(currentStep);

      if (!step) {
        throw new WorkflowExecutionError(`Step '${currentStep}' not found`);
      }

      const startedAt = new Date();
      const previousState = state;

      state = WorkflowExecutionMapper.toState(
        WorkflowExecutionMapper.fromState(state).startStep(state.currentStep),
      );

      state = await this.stateService.save(previousState, state);

      const stepResult = await this.stepExecutor.execute(
        workflow,
        state,
        pendingSignal,
      );

      state = stepResult.latestState;
      const result = stepResult.result;

      pendingSignal = undefined;
      const completedAt = new Date();

      const allowedTransitions =
        workflow.metadata.definition.transitions[currentStep] ?? [];

      if (result.nextStep && !allowedTransitions.includes(result.nextStep)) {
        throw new WorkflowExecutionError(
          `Workflow '${state.workflowName}' cannot transition from '${state.currentStep}' to '${result.nextStep}'`,
        );
      }

      const previousCompletedState = state;

      const stepExecution = {
        step: step.metadata.step,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: 'completed' as const,
      };

      await this.history.append(state.workflowId, stepExecution);

      state = this.transitions.completeStep(
        state,
        stepExecution,
        result.nextStep,
        result.waitForSignal,
        result.data,
      );

      state = await this.stateService.save(previousCompletedState, state);

      if (result.waitForSignal) {
        break;
      }
    }

    return state;
  }

  async resume(workflowId: string): Promise<WorkflowExecutionResult> {
    const state = await this.stateService.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    if (state.status === 'waiting') {
      return this.toResult(state);
    }

    if (state.status !== 'running') {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' cannot be resumed from status '${state.status}'`,
      );
    }

    const workflow = this.registry.get(
      state.workflowName,
      state.workflowVersion,
    );

    let finalState: WorkflowExecutionState;

    try {
      finalState = await this.run(workflow, state);
    } catch (error) {
      const reloadedState = (await this.stateService.load(workflowId)) ?? state;
      await this.failureService.failExecution(reloadedState, error);
      throw error;
    }

    if (
      finalState.status === 'running' &&
      finalState.currentStep === undefined
    ) {
      const prev = finalState;
      finalState = await this.stateService.save(
        prev,
        this.transitions.completeWorkflow(finalState),
      );
    }

    return this.toResult(finalState);
  }

  async execute(
    workflowName: string,
    initialData: Record<string, unknown> = {},
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.registry.getLatest(workflowName);

    let state = this.stateFactory.create(workflow, initialData);
    await this.stateService.insert(state);

    try {
      state = await this.run(workflow, state);
    } catch (error) {
      const reloadedState =
        (await this.stateService.load(state.workflowId)) ?? state;

      const failedAt = new Date();
      const failedStep =
        reloadedState.executingStep ?? reloadedState.currentStep;
      const previousState = reloadedState;

      if (failedStep) {
        await this.history.append(state.workflowId, {
          step: failedStep,
          startedAt: reloadedState.stepStartedAt ?? failedAt,
          completedAt: failedAt,
          durationMs:
            failedAt.getTime() -
            (reloadedState.stepStartedAt ?? failedAt).getTime(),
          status: 'failed',
          error: this.failureService.serialize(error),
        });

        const stepExecution = {
          step: failedStep,
          startedAt: reloadedState.stepStartedAt ?? failedAt,
          completedAt: failedAt,
          durationMs:
            failedAt.getTime() -
            (reloadedState.stepStartedAt ?? failedAt).getTime(),
          status: 'failed' as const,
          error: this.failureService.serialize(error),
        };

        const failedState = this.transitions.failStep(
          reloadedState,
          stepExecution,
          this.failureService.toFailure(error),
        );

        await this.stateService.save(previousState, failedState);
      }

      throw error;
    }

    if (state.status === 'running' && state.currentStep === undefined) {
      const previousState = state;
      state = this.transitions.completeWorkflow(state);
      state = await this.stateService.save(previousState, state);
    }

    return this.toResult(state);
  }

  async cancel(workflowId: string): Promise<WorkflowExecutionResult> {
    const state = await this.stateService.cancel(workflowId);

    return this.toResult(state);
  }

  async signal(
    workflowId: string,
    signal: WorkflowSignal,
  ): Promise<WorkflowExecutionResult> {
    const idempotencyKey = buildSignalIdempotencyKey(
      workflowId,
      signal.signalId,
    );

    const acquired = await this.idempotencyStore.acquire(
      idempotencyKey,
      workflowId,
    );

    if (!acquired) {
      const existing = await this.stateService.load(workflowId);

      if (!existing) {
        throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
      }

      return this.toResult(existing);
    }

    const appended = await this.signals.append(workflowId, signal);

    if (!appended) {
      const existing = await this.signals.load(signal.signalId);

      if (existing?.processed) {
        const current = await this.stateService.load(workflowId);

        if (!current) {
          throw new WorkflowExecutionError(
            `Workflow '${workflowId}' not found`,
          );
        }

        return this.toResult(current);
      }
    }

    let state = await this.stateService.load(workflowId);

    if (!state) {
      throw new WorkflowExecutionError(`Workflow '${workflowId}' not found`);
    }

    this.stateValidator.validate(state);

    if (state.waitingForSignal?.name !== signal.name) {
      throw new WorkflowExecutionError(
        `Workflow '${workflowId}' is not waiting for '${signal.name}'`,
      );
    }

    const nextState = this.transitions.resumeFromSignal(state);
    state = await this.stateService.save(state, nextState);

    const workflow = this.registry.get(
      nextState.workflowName,
      nextState.workflowVersion,
    );

    let finalState: WorkflowExecutionState | undefined;

    try {
      finalState = await this.run(workflow, state, signal);
    } catch (error) {
      const latest =
        (await this.stateService.load(workflowId)) ?? finalState ?? state;
      if (latest.executingStep) {
        const failedAt = new Date();

        await this.history.append(state.workflowId, {
          step: latest.executingStep,
          startedAt: latest.stepStartedAt ?? failedAt,
          completedAt: failedAt,
          durationMs:
            failedAt.getTime() - (latest.stepStartedAt ?? failedAt).getTime(),
          status: 'failed',
          error: this.failureService.serialize(error),
        });
      }

      const failedState = this.transitions.failWorkflow(
        latest,
        this.failureService.toFailure(error),
      );

      await this.stateService.save(latest, failedState);

      throw error;
    }

    if (
      finalState.status === 'running' &&
      finalState.currentStep === undefined
    ) {
      const previousState = finalState;

      finalState = await this.stateService.save(
        previousState,
        this.transitions.completeWorkflow(finalState),
      );
    }

    await this.signals.markProcessed(signal.signalId);

    await this.idempotencyStore.markCompleted(
      idempotencyKey,
      finalState.workflowId,
    );

    return this.toResult(finalState);
  }
}
