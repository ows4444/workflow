export interface RegistrationState {
  readonly email: string;

  readonly userId?: string;

  readonly verificationToken?: string;

  readonly emailVerifiedAt?: string;

  readonly registrationCompleted?: boolean;
}
