import { WorkflowCompensationHandler } from '@/workflow/handlers/workflow-compensation-handler';
import { WorkflowStepHandler } from '@/workflow/handlers/workflow-step-handler';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class WorkflowStepResolver {
  constructor(private readonly moduleRef: ModuleRef) {}

  resolve(
    type: new (...args: never[]) => WorkflowStepHandler,
  ): WorkflowStepHandler {
    return this.moduleRef.get(type, {
      strict: false,
    });
  }

  resolveCompensation(
    type: new (...args: never[]) => WorkflowCompensationHandler,
  ): WorkflowCompensationHandler {
    return this.moduleRef.get(type, {
      strict: false,
    });
  }
}
