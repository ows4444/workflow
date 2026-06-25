import { SetMetadata } from '@nestjs/common';

import { WORKFLOW_SIGNAL_METADATA } from '../constants/workflow.constants';
import { WorkflowSignalMetadata } from '../metadata/workflow-signal-metadata';

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
