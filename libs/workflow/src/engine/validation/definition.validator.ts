import { Injectable } from '@nestjs/common';
import { WorkflowConfigurationError } from '../../errors/workflow.errors';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowStepId } from '../../models/workflow-step-id';

@Injectable()
export class WorkflowDefinitionValidator {
  validate(workflow: RegisteredWorkflow): void {
    this.validateStartStep(workflow);
    this.validateTransitions(workflow);
    this.validateReachability(workflow);
    this.validateCycles(workflow);
    this.validateTerminalSteps(workflow);
    this.validateRetryPolicy(workflow);
    this.validateTimeouts(workflow);
    this.validateSignals(workflow);
    this.validateDeprecatedSteps(workflow);
    this.validateChildWorkflows(workflow);
    this.validateCompensation(workflow);
  }

  private validateCompensation(workflow: RegisteredWorkflow): void {
    const compensation = workflow.metadata.compensation;

    if (!compensation) {
      return;
    }

    if (
      compensation.strategy === 'custom' &&
      (!compensation.order || compensation.order.length === 0)
    ) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' uses custom compensation without defining an order.`,
      );
    }

    for (const step of compensation.order ?? []) {
      if (!workflow.steps.has(step)) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' references unknown compensation step '${step}'.`,
        );
      }
    }
  }

  private validateSignals(workflow: RegisteredWorkflow): void {
    const signals = workflow.metadata.signals;

    if (!signals) {
      return;
    }

    if (
      signals.defaultTimeoutMs !== undefined &&
      (!Number.isFinite(signals.defaultTimeoutMs) ||
        signals.defaultTimeoutMs <= 0)
    ) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' has an invalid signal timeout.`,
      );
    }

    const supported = signals.supportedSignals;

    if (!supported) {
      return;
    }

    const unique = new Set<string>();

    for (const signal of supported) {
      if (!signal.trim()) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' declares an empty signal name.`,
        );
      }

      if (unique.has(signal)) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' declares duplicate signal '${signal}'.`,
        );
      }

      unique.add(signal);
    }
  }

  private validateTimeouts(workflow: RegisteredWorkflow): void {
    const validateTimeout = (name: string, value?: number) => {
      if (value === undefined) {
        return;
      }

      if (!Number.isFinite(value) || value <= 0) {
        throw new WorkflowConfigurationError(
          `${name} must be a positive finite number.`,
        );
      }
    };

    validateTimeout(
      `Workflow '${workflow.metadata.name}' defaultStepTimeoutMs`,
      workflow.metadata.defaultStepTimeoutMs,
    );

    for (const step of workflow.steps.values()) {
      validateTimeout(
        `Step '${step.metadata.step}' timeoutMs`,
        step.metadata.timeoutMs,
      );
    }
  }

  private validateChildWorkflows(workflow: RegisteredWorkflow): void {
    const children = workflow.metadata.childWorkflows;

    if (!children) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const seen = new Set<Function>();

    for (const child of children) {
      if (seen.has(child.workflow)) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' declares child workflow '${child.workflow.name}' more than once.`,
        );
      }

      if (child.workflow === workflow.workflowType) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' cannot declare itself as a child workflow.`,
        );
      }

      switch (child.failurePolicy) {
        case 'fail-parent':
        case 'ignore':
        case 'retry-child':
        case 'compensate-parent':
          break;

        default:
          child.failurePolicy satisfies never;
      }

      switch (child.cancellationPolicy) {
        case 'propagate':
        case 'detach':
          break;

        default:
          child.cancellationPolicy satisfies never;
      }

      seen.add(child.workflow);
    }
  }

  private validateDeprecatedSteps(workflow: RegisteredWorkflow): void {
    for (const step of workflow.steps.values()) {
      const metadata = step.metadata;

      if (
        metadata.deprecated &&
        workflow.metadata.definition.start === metadata.step
      ) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' cannot start on deprecated step '${metadata.step}'.`,
        );
      }

      if (!metadata.replacedBy) {
        continue;
      }

      if (!workflow.steps.has(metadata.replacedBy)) {
        throw new WorkflowConfigurationError(
          `Step '${metadata.step}' replaces unknown step '${metadata.replacedBy}'`,
        );
      }

      if (metadata.replacedBy === metadata.step) {
        throw new WorkflowConfigurationError(
          `Step '${metadata.step}' cannot replace itself.`,
        );
      }
    }
  }

  private validateTerminalSteps(workflow: RegisteredWorkflow): void {
    const hasTerminalStep = [...workflow.steps.keys()].some(
      (step) =>
        (workflow.metadata.definition.transitions[step] ?? []).length === 0,
    );

    if (!workflow.metadata.definition.allowCycles && !hasTerminalStep) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' has no terminal step`,
      );
    }
  }

  private validateRetryPolicy(workflow: RegisteredWorkflow): void {
    const retry = workflow.metadata.retries;

    if (!retry) {
      return;
    }

    if (retry.maxAttempts < 1) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' maxAttempts must be >= 1`,
      );
    }
  }

  private validateReachability(workflow: RegisteredWorkflow): void {
    const visited = new Set<string>();

    const stack = [workflow.metadata.definition.start];

    while (stack.length > 0) {
      const current = stack.pop();

      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);

      const targets = workflow.metadata.definition.transitions[current] ?? [];

      stack.push(...targets);
    }

    for (const step of workflow.steps.keys()) {
      if (!visited.has(step)) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' contains unreachable step '${step}'`,
        );
      }
    }
  }

  private validateCycles(workflow: RegisteredWorkflow): void {
    if (workflow.metadata.definition.allowCycles) {
      return;
    }

    const visited = new Set<string>();
    const recursion = new Set<string>();

    const transitions = workflow.metadata.definition.transitions;

    const dfs = (step: string): boolean => {
      if (recursion.has(step)) {
        return true;
      }

      if (visited.has(step)) {
        return false;
      }

      visited.add(step);
      recursion.add(step);

      for (const next of transitions[step as WorkflowStepId] ?? []) {
        if (dfs(next)) {
          return true;
        }
      }

      recursion.delete(step);

      return false;
    };

    if (dfs(workflow.metadata.definition.start)) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' contains a cycle`,
      );
    }
  }

  private validateStartStep(workflow: RegisteredWorkflow): void {
    const start = workflow.metadata.definition.start;

    if (!workflow.steps.has(start)) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' start step '${start}' does not exist`,
      );
    }
  }

  private validateTransitions(workflow: RegisteredWorkflow): void {
    const transitions = workflow.metadata.definition.transitions;

    for (const [source, targets] of Object.entries(transitions) as [
      WorkflowStepId,
      readonly WorkflowStepId[],
    ][]) {
      if (!workflow.steps.has(source)) {
        throw new WorkflowConfigurationError(
          `Workflow '${workflow.metadata.name}' transition source '${source}' does not exist`,
        );
      }

      for (const target of targets ?? []) {
        if (!workflow.steps.has(target)) {
          throw new WorkflowConfigurationError(
            `Workflow '${workflow.metadata.name}' transition target '${target}' does not exist`,
          );
        }
      }
    }
  }
}
