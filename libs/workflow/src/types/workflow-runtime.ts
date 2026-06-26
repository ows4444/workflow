export interface WorkflowRuntime {
  /**
   * @deprecated Use runtime.abortSignal instead.
   */
  readonly abortSignal: AbortSignal;

  isCancelled(): Promise<boolean>;
}
