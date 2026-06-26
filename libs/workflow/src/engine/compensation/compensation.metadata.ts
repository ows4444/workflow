import { WorkflowStepId } from '@/workflow/models/workflow-step-id';

export interface WorkflowCompensationMetadata {
  readonly enabled: boolean;

  readonly strategy: 'reverse-order' | 'custom';

  readonly order?: readonly WorkflowStepId[];
}
