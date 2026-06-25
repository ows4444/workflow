import { SetMetadata } from '@nestjs/common';

import { WORKFLOW_HOOK_METADATA } from '../constants/workflow.constants';
import { WorkflowHookMetadata } from '../metadata/workflow-hook-metadata';

export function WorkflowHooks(metadata: WorkflowHookMetadata): ClassDecorator {
  return SetMetadata(
    WORKFLOW_HOOK_METADATA,
    Object.freeze({
      ...metadata,
    }),
  );
}
