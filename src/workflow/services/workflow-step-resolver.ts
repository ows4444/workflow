import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { WorkflowStepHandler } from '../contracts/workflow-step-handler';

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
}
