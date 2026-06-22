export interface WorkflowSignal<TPayload = unknown> {
  readonly name: string;

  readonly payload?: TPayload;
}
