export abstract class VerificationTokenStore {
  abstract save(token: string, workflowId: string): Promise<void>;

  abstract findWorkflowId(token: string): Promise<string | null>;
}
