import { Inject, Injectable, Logger } from '@nestjs/common';

import { WorkflowExecutor } from '../executor/executor';
import { RegisteredWorkflow } from '../../models/registered-workflow';
import { WorkflowExecutionState } from '../../models/workflow-execution-state';
import { WorkflowStateService } from '../state/service';
import { WorkflowChildMetadata } from '@/workflow/definition/workflow-child-metadata';
import { WorkflowCompensationService } from '../compensation/service';
import { WorkflowRegistry } from '../registry/registry';
import { WorkflowParentFailureHandler } from '@/workflow/ports/workflow-parent-failure-handler';
import { WORKFLOW_PARENT_FAILURE_HANDLER } from '@/workflow/constants/workflow.tokens';
import { NonRetriableWorkflowError } from '@/workflow/errors';

@Injectable()
export class ChildWorkflowService {
  private readonly logger = new Logger(ChildWorkflowService.name);
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly stateService: WorkflowStateService,
    private readonly compensation: WorkflowCompensationService,
    private readonly registry: WorkflowRegistry,

    @Inject(WORKFLOW_PARENT_FAILURE_HANDLER)
    private readonly parentFailureHandler: WorkflowParentFailureHandler,
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
    child: WorkflowExecutionState,
  ): Promise<void> {
    const parentWorkflow = this.registry.get(
      parent.workflowName,
      parent.workflowVersion,
    );

    const definition = this.findDefinition(parentWorkflow, child);

    if (!definition) {
      // Child is not a managed child of this parent; nothing to do.
      return;
    }

    this.logger.debug(
      `Child workflow '${child.workflowName}' (${child.workflowId}) completed ` +
        `for parent '${parent.workflowName}' (${parent.workflowId})`,
    );
  }

  async onChildFailed(
    parent: WorkflowExecutionState,
    child: WorkflowExecutionState,
  ): Promise<void> {
    const parentWorkflow = this.registry.get(
      parent.workflowName,
      parent.workflowVersion,
    );

    const definition = this.findDefinition(parentWorkflow, child);

    if (!definition) {
      // Child is not a managed child of this parent; nothing to do.
      return;
    }

    const { failurePolicy } = definition;

    this.logger.warn(
      `Child workflow '${child.workflowName}' (${child.workflowId}) failed ` +
        `for parent '${parent.workflowName}' (${parent.workflowId}) ` +
        `— applying policy '${failurePolicy}'`,
    );

    switch (failurePolicy) {
      case 'ignore':
        return;

      case 'fail-parent': {
        if (
          parent.status === 'completed' ||
          parent.status === 'cancelled' ||
          parent.status === 'failed'
        ) {
          this.logger.warn(
            `Cannot apply 'fail-parent' policy: parent '${parent.workflowId}' ` +
              `is already in terminal status '${parent.status}'`,
          );
          return;
        }

        const reason = child.lastFailure?.message ?? 'Child workflow failed';

        await this.parentFailureHandler.failExecution(
          parent,
          new NonRetriableWorkflowError(
            `Child workflow '${child.workflowName}' failed: ${reason}`,
          ),
        );
        return;
      }

      case 'retry-child': {
        if (
          child.status !== 'failed' ||
          child.lastFailure?.retriable === false
        ) {
          this.logger.warn(
            `'retry-child' policy skipped: child '${child.workflowId}' ` +
              `failure is non-retriable or not in failed status`,
          );
          return;
        }

        const maxRetries = definition.maxRetries ?? 1;
        const attempts = child.failureCount ?? 0;

        if (attempts >= maxRetries) {
          this.logger.warn(
            `'retry-child' policy exhausted for child '${child.workflowName}' ` +
              `(${child.workflowId}): failureCount=${attempts} >= maxRetries=${maxRetries}. ` +
              `Child will remain in failed status.`,
          );
          return;
        }

        try {
          await this.executor.execute(child.workflowName, child.data, {
            correlationId: child.correlationId,
            parentWorkflowId: child.parentWorkflowId,
            parentExecutionId: child.parentExecutionId,
          });

          this.logger.debug(
            `'retry-child' re-executed child '${child.workflowName}' ` +
              `(${child.workflowId}): attempt=${attempts + 1}/${maxRetries}`,
          );
        } catch (error) {
          this.logger.error(
            `'retry-child' policy failed to re-execute child '${child.workflowName}' ` +
              `(${child.workflowId})`,
            error instanceof Error ? error.stack : String(error),
          );
        }
        return;
      }

      case 'compensate-parent': {
        if (
          parent.status === 'completed' ||
          parent.status === 'cancelled' ||
          parent.status === 'failed'
        ) {
          this.logger.warn(
            `Cannot apply 'compensate-parent' policy: parent '${parent.workflowId}' ` +
              `is already in terminal status '${parent.status}'`,
          );
          return;
        }

        const reason = child.lastFailure?.message ?? 'Child workflow failed';

        await this.parentFailureHandler.failExecution(
          parent,
          new NonRetriableWorkflowError(
            `Child workflow '${child.workflowName}' failed (compensation triggered): ${reason}`,
          ),
        );
        return;
      }

      default:
        failurePolicy satisfies never;
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
