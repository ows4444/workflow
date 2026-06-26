import { Injectable } from '@nestjs/common';

import { WorkflowExecutor } from '../executor/executor';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowStateService } from '../state/service';
import { WorkflowChildMetadata } from '@/workflow/definition/workflow-child-metadata';
import { WorkflowCompensationService } from '../compensation/service';
import { WorkflowRegistry } from '../registry/registry';

@Injectable()
export class ChildWorkflowService {
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly stateService: WorkflowStateService,
    private readonly compensation: WorkflowCompensationService,
    private readonly registry: WorkflowRegistry,
  ) {}

  findDefinition(
    workflow: RegisteredWorkflow,
    child: WorkflowExecutionState,
  ): WorkflowChildMetadata | undefined {
    return workflow.metadata.childWorkflows?.find((definition) => {
      const registered = this.registry
        .getAll()
        .find((candidate) => candidate.workflowType === definition.workflow);

      return (
        registered?.metadata.name === child.workflowName &&
        registered.metadata.version === child.workflowVersion
      );
    });
  }

  isManagedChild(
    workflow: RegisteredWorkflow,
    child: WorkflowExecutionState,
  ): boolean {
    return this.findDefinition(workflow, child) !== undefined;
  }

  async findChildren(
    parentWorkflowId: string,
  ): Promise<WorkflowExecutionState[]> {
    return this.stateService.findByParentWorkflowId(parentWorkflowId);
  }

  async findParent(
    state: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState | null> {
    if (!state.parentWorkflowId) {
      return null;
    }

    return this.stateService.load(state.parentWorkflowId);
  }

  async onChildCompleted(
    parent: WorkflowExecutionState,
    _child: WorkflowExecutionState,
  ): Promise<void> {
    const latest = await this.stateService.reload(parent);

    if (latest.status === 'running' && latest.currentStep === undefined) {
      await this.executor.resume(latest.workflowId);
    }
  }

  async onChildFailed(
    parent: WorkflowExecutionState,
    child: WorkflowExecutionState,
  ): Promise<void> {
    const workflow = this.executor.getDefinition(parent.workflowName);

    const definition = this.findDefinition(workflow, child);

    if (!definition) {
      return;
    }

    switch (definition.failurePolicy) {
      case 'ignore':
        return;

      case 'fail-parent':
        await this.executor.fail(
          parent.workflowId,
          new WorkflowFailureError(
            `Child workflow '${child.workflowName}' failed.`,
            false,
          ),
        );
        return;

      case 'retry-child':
        await this.executor.resume(child.workflowId);
        return;

      case 'compensate-parent': {
        const registered = this.executor.getDefinition(
          parent.workflowName,
          parent.workflowVersion,
        );

        await this.compensation.compensate(registered, parent);

        return;
      }
    }
  }

  async startChildren(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const children = workflow.metadata.childWorkflows;

    if (!children?.length) {
      return;
    }

    for (const child of children) {
      await this.executor.execute(
        child.workflow.name,
        {},
        {
          correlationId: state.correlationId,
          parentWorkflowId: state.workflowId,
          parentExecutionId: state.executionId,
        },
      );
    }
  }

  async cancelChildren(
    workflow: RegisteredWorkflow,
    state: WorkflowExecutionState,
  ): Promise<void> {
    const children = workflow.metadata.childWorkflows;

    if (!children?.length) {
      return;
    }

    const executions = await this.executor.findByParentWorkflowId(
      state.workflowId,
    );

    for (const execution of executions) {
      const definition = children.find(
        (x) => x.workflow.name === execution.workflowName,
      );

      if (!definition) {
        continue;
      }

      if (definition.cancellationPolicy !== 'propagate') {
        continue;
      }

      if (
        execution.status === 'completed' ||
        execution.status === 'cancelled' ||
        execution.status === 'failed'
      ) {
        continue;
      }

      await this.executor.cancel(execution.workflowId);
    }
  }
}
