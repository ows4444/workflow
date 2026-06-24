export class WorkflowConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = WorkflowConfigurationError.name;
  }
}

export class WorkflowExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = WorkflowExecutionError.name;
  }
}

export class WorkflowConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = WorkflowConcurrencyError.name;
  }
}
