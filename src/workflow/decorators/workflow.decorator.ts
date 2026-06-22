import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

import { WORKFLOW_METADATA } from '../constants/workflow.constants';
import { WorkflowMetadata } from '../contracts/workflow-metadata';

export function Workflow(metadata: WorkflowMetadata): ClassDecorator {
  return applyDecorators(
    Injectable(),
    SetMetadata(WORKFLOW_METADATA, Object.freeze({ ...metadata })),
  );
}
