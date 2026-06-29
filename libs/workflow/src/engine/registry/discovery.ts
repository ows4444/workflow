import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import {
  WORKFLOW_HOOK_METADATA,
  WORKFLOW_METADATA,
  WORKFLOW_SIGNAL_METADATA,
} from '../../constants/workflow.constants';
import { WORKFLOW_STEP_METADATA } from '../../constants/workflow.constants';
import { WorkflowHookMetadata } from '../hooks/hook.metadata';
import { WorkflowSignalMetadata } from '../signals/signal.metadata';
import { WorkflowDefinitionValidator } from '../validation/definition.validator';
import { WorkflowRegistry } from './registry';
import { WorkflowMetadata } from '../../definition/workflow-metadata';
import { WorkflowStepMetadata } from '../../definition/workflow-step-metadata';
import { WorkflowConfigurationError } from '../../errors/workflow.errors';
import { WorkflowStepHandler } from '../../handlers/workflow-step-handler';
import { RegisteredWorkflowStep } from '../../models/registered-workflow';
import { WorkflowStepId } from '../../models/workflow-step-id';

interface MutableRegisteredWorkflow {
  readonly metadata: WorkflowMetadata;
  readonly workflowType: Type<unknown>;
  readonly steps: Map<WorkflowStepId, RegisteredWorkflowStep>;

  readonly transitions: Map<WorkflowStepId, ReadonlySet<WorkflowStepId>>;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return value;
}

@Injectable()
export class WorkflowDiscovery implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly registry: WorkflowRegistry,
    private readonly validator: WorkflowDefinitionValidator,
  ) {}

  private registerStep(
    workflow: MutableRegisteredWorkflow,
    metadata: WorkflowStepMetadata,
    type: Type<WorkflowStepHandler>,
  ): void {
    if (workflow.steps.has(metadata.step)) {
      throw new WorkflowConfigurationError(
        `Duplicate step '${metadata.step}' in workflow '${workflow.metadata.name}'`,
      );
    }

    workflow.steps.set(metadata.step, {
      metadata,
      type,
    });
  }

  private findWorkflow(
    workflows: Map<string, MutableRegisteredWorkflow>,
    name: string,
    version: number,
  ): MutableRegisteredWorkflow | undefined {
    return workflows.get(WorkflowRegistry.buildKey(name, version));
  }

  private createWorkflowMetadata(
    workflow: WorkflowMetadata,
    hooks?: WorkflowHookMetadata,
    signals?: WorkflowSignalMetadata,
  ): WorkflowMetadata {
    return Object.freeze({
      ...workflow,
      hooks: hooks ?? workflow.hooks,
      signals: signals ?? workflow.signals,
    });
  }

  onModuleInit(): void {
    const providers = this.discovery.getProviders();

    const workflows = new Map<string, MutableRegisteredWorkflow>();

    for (const wrapper of providers) {
      const type = wrapper.metatype;

      if (!type) {
        continue;
      }

      const workflowMetadata = this.reflector.get<WorkflowMetadata>(
        WORKFLOW_METADATA,
        type,
      );

      if (!workflowMetadata) {
        continue;
      }

      const hookMetadata = this.reflector.get<WorkflowHookMetadata>(
        WORKFLOW_HOOK_METADATA,
        type,
      );

      const signalMetadata = this.reflector.get<WorkflowSignalMetadata>(
        WORKFLOW_SIGNAL_METADATA,
        type,
      );

      const metadata: WorkflowMetadata = deepFreeze({
        ...workflowMetadata,
        hooks: hookMetadata ?? workflowMetadata.hooks,
        signals: signalMetadata ?? workflowMetadata.signals,
      });

      const key = WorkflowRegistry.buildKey(metadata.name, metadata.version);
      if (workflows.has(key)) {
        throw new WorkflowConfigurationError(
          `Workflow '${metadata.name}' version '${metadata.version}' already exists`,
        );
      }

      workflows.set(key, {
        metadata,
        workflowType: type as Type<unknown>,
        steps: new Map(),
        transitions: new Map(),
      });
    }

    for (const wrapper of providers) {
      const type = wrapper.metatype as Type<WorkflowStepHandler> | undefined;

      if (!type) {
        continue;
      }

      const metadata = this.reflector.get<WorkflowStepMetadata>(
        WORKFLOW_STEP_METADATA,
        type,
      );

      if (!metadata) {
        continue;
      }

      const resolvedVersion =
        metadata.workflowVersion ??
        Math.max(
          ...[...workflows.values()]
            .filter((w) => w.metadata.name === metadata.workflow)
            .map((w) => w.metadata.version),
        );
      const workflow = this.findWorkflow(
        workflows,
        metadata.workflow,
        resolvedVersion,
      );

      if (!workflow) {
        const knownVersions = [...workflows.keys()]
          .filter((k) => k.startsWith(`${metadata.workflow}:`))
          .map((k) => k.split(':')[1]);
        const hint =
          knownVersions.length > 0
            ? ` (workflow '${metadata.workflow}' exists at version(s) ${knownVersions.join(', ')} — did you forget to set workflowVersion on the @Step decorator?)`
            : '';
        throw new WorkflowConfigurationError(
          `Step '${metadata.step}' references unknown workflow '${metadata.workflow}' v${resolvedVersion}${hint}`,
        );
      }

      if (workflow.steps.has(metadata.step)) {
        throw new WorkflowConfigurationError(
          `Duplicate step '${metadata.step}' in workflow '${metadata.workflow}'`,
        );
      }

      this.registerStep(workflow, metadata, type);
    }

    for (const workflow of workflows.values()) {
      this.validator.validate(workflow);

      for (const child of workflow.metadata.childWorkflows ?? []) {
        const childDefinition = [...workflows.values()].find(
          (candidate) => candidate.workflowType === child.workflow,
        );

        if (
          childDefinition?.metadata.childWorkflows?.some(
            (nested) => nested.workflow === workflow.workflowType,
          )
        ) {
          throw new WorkflowConfigurationError(
            `Circular child workflow relationship detected between '${workflow.metadata.name}' and '${childDefinition.metadata.name}'.`,
          );
        }
      }

      for (const child of workflow.metadata.childWorkflows ?? []) {
        const registered = [...workflows.values()].some(
          (candidate) => candidate.workflowType === child.workflow,
        );

        if (!registered) {
          throw new WorkflowConfigurationError(
            `Workflow '${workflow.metadata.name}' references unregistered child workflow '${child.workflow.name}'.`,
          );
        }
      }

      const transitions = new Map<
        WorkflowStepId,
        ReadonlySet<WorkflowStepId>
      >();

      for (const [step, targets] of Object.entries(
        workflow.metadata.definition.transitions,
      ) as [WorkflowStepId, readonly WorkflowStepId[]][]) {
        transitions.set(step, new Set(targets));
      }

      this.registry.register({
        ...workflow,
        transitions,
      });
    }
  }
}
