import { WorkflowConfigurationError } from '@/workflow/errors/workflow.errors';
import { RegisteredWorkflow } from '@/workflow/models/registered-workflow';
import { WorkflowStepId } from '@/workflow/models/workflow-step-id';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowDefinitionValidator {
  validate(workflow: RegisteredWorkflow): void {
    this.validateStartStep(workflow);
    this.validateTransitions(workflow);
    this.validateReachability(workflow);
    this.validateCycles(workflow);
    this.validateTerminalSteps(workflow);
    this.validateRetryPolicy(workflow);
    this.validateDeprecatedSteps(workflow);
  }

  private validateDeprecatedSteps(workflow: RegisteredWorkflow): void {
    for (const step of workflow.steps.values()) {
      const metadata = step.metadata;

      if (!metadata.replacedBy) {
        continue;
      }

      if (!workflow.steps.has(metadata.replacedBy)) {
        throw new WorkflowConfigurationError(
          `Step '${metadata.step}' replaces unknown step '${metadata.replacedBy}'`,
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
