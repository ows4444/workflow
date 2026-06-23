export interface CreateUserInput {
  readonly email: string;
}

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly isActive: boolean;
}

export abstract class UserRepository {
  abstract existsByEmail(email: string): Promise<boolean>;

  abstract create(input: CreateUserInput): Promise<UserRecord>;

  abstract activate(userId: string): Promise<void>;

  abstract findById(userId: string): Promise<UserRecord | null>;
}
