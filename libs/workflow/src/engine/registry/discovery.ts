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

@Injectable()
export class WorkflowDiscovery implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly registry: WorkflowRegistry,
    private readonly validator: WorkflowDefinitionValidator,
  ) {}

  onModuleInit(): void {
    const providers = this.discovery.getProviders();

    const workflows = new Map<string, MutableRegisteredWorkflow>();

    const workflowKey = (name: string, version: number) => `${name}:${version}`;

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

      const metadata: WorkflowMetadata = Object.freeze({
        ...workflowMetadata,
        hooks: hookMetadata ?? workflowMetadata.hooks,
        signals: signalMetadata ?? workflowMetadata.signals,
      });

      const key = workflowKey(metadata.name, metadata.version);

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
      const type = wrapper.metatype;

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

      const resolvedVersion = metadata.workflowVersion ?? 1;
      const workflow = workflows.get(
        workflowKey(metadata.workflow, resolvedVersion),
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

      workflow.steps.set(metadata.step, {
        metadata,
        type: type as Type<WorkflowStepHandler>,

        // compensation: metadata.compensation?.handler,
      });
    }

    for (const workflow of workflows.values()) {
      this.validator.validate(workflow);

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
