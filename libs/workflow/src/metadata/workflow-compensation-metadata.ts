export interface WorkflowCompensationMetadata {
  readonly enabled: boolean;

  readonly strategy: 'reverse-order' | 'custom';
}
