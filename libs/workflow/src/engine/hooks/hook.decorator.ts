import { WORKFLOW_HOOK_METADATA } from '@/workflow/constants/workflow.constants';
import { SetMetadata } from '@nestjs/common';
import { WorkflowHookMetadata } from './hook.metadata';

export function WorkflowHooks(metadata: WorkflowHookMetadata): ClassDecorator {
  return SetMetadata(
    WORKFLOW_HOOK_METADATA,
    Object.freeze({
      ...metadata,
    }),
  );
}
