import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowConfigurationError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowRegistry {
  private readonly workflows = new Map<string, RegisteredWorkflow>();

  private buildKey(name: string, version: number): string {
    return `${name}:${version}`;
  }

  getLatest(name: string): RegisteredWorkflow {
    const versions = [...this.workflows.values()].filter(
      (x) => x.metadata.name === name,
    );

    if (versions.length === 0) {
      throw new WorkflowConfigurationError(`Workflow '${name}' not found`);
    }

    return versions.reduce((latest, current) =>
      current.metadata.version > latest.metadata.version ? current : latest,
    );
  }

  register(workflow: RegisteredWorkflow): void {
    const key = this.buildKey(
      workflow.metadata.name,
      workflow.metadata.version,
    );

    if (this.workflows.has(key)) {
      throw new WorkflowConfigurationError(
        `Workflow '${workflow.metadata.name}' already registered`,
      );
    }

    this.workflows.set(key, workflow);
  }

  get(name: string, version: number): RegisteredWorkflow {
    const workflow = this.workflows.get(this.buildKey(name, version));

    if (!workflow) {
      throw new WorkflowConfigurationError(`Workflow '${name}' not found`);
    }

    return workflow;
  }

  getAll(): readonly RegisteredWorkflow[] {
    return [...this.workflows.values()];
  }
}
