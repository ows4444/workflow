import { Injectable } from '@nestjs/common';

import { RegisteredWorkflow } from '../contracts/registered-workflow';
import { WorkflowStepId } from '../contracts/workflow-step-id';
import { WorkflowStepResult } from '../contracts/workflow-step-result';
import { WorkflowExecutionError } from '../errors/workflow.errors';

@Injectable()
export class WorkflowStepResultValidator {
  validate(
    workflow: RegisteredWorkflow,
    currentStep: WorkflowStepId,
    result: WorkflowStepResult,
  ): void {
    if (result.nextStep === undefined && result.waitForSignal === undefined) {
      return;
    }

    if (result.waitForSignal && result.nextStep === undefined) {
      throw new WorkflowExecutionError(
        `Step '${currentStep}' waits for a signal but does not specify a resume step.`,
      );
    }

    if (result.nextStep && !workflow.steps.has(result.nextStep)) {
      throw new WorkflowExecutionError(
        `Unknown workflow step '${result.nextStep}'.`,
      );
    }
  }
}
