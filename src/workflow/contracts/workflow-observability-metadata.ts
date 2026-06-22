export interface WorkflowObservabilityMetadata {
  readonly metrics?: boolean;

  readonly tracing?: boolean;

  readonly audit?: boolean;

  readonly executionHistory?: boolean;
}
