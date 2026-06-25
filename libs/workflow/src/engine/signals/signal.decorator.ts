import { WORKFLOW_SIGNAL_METADATA } from '@/workflow/constants/workflow.constants';
import { SetMetadata } from '@nestjs/common';
import { WorkflowSignalMetadata } from './signal.metadata';

export function WorkflowSignals(
  metadata: WorkflowSignalMetadata,
): ClassDecorator {
  return SetMetadata(
    WORKFLOW_SIGNAL_METADATA,
    Object.freeze({
      ...metadata,
    }),
  );
}
