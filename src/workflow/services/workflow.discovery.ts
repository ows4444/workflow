import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { WORKFLOW_METADATA } from '../constants/workflow.constants';
import { WORKFLOW_STEP_METADATA } from '../constants/workflow.constants';

import { WorkflowMetadata } from '../contracts/workflow-metadata';
import { WorkflowStepMetadata } from '../contracts/workflow-step-metadata';
import { RegisteredWorkflowStep } from '../contracts/registered-workflow';

import { WorkflowRegistry } from './workflow.registry';
import { WorkflowDefinitionValidator } from './workflow-definition.validator';
import { WorkflowConfigurationError } from '../errors/workflow.errors';
import { WorkflowStepHandler } from '../contracts/workflow-step-handler';
import { WorkflowStepId } from '../contracts/workflow-step-id';

interface MutableRegisteredWorkflow {
  readonly metadata: WorkflowMetadata;
  readonly workflowType: Type<unknown>;
  readonly steps: Map<WorkflowStepId, RegisteredWorkflowStep>;
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

      const metadata = this.reflector.get<WorkflowMetadata>(
        WORKFLOW_METADATA,
        type,
      );

      if (!metadata) {
        continue;
      }

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
      });
    }

    for (const workflow of workflows.values()) {
      this.validator.validate(workflow);
      this.registry.register(workflow);
    }
  }
}
