import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  CreateUserInput,
  UserRecord,
  UserRepository,
} from '../../domain/repositories/user.repository';

@Injectable()
export class InMemoryUserRepository extends UserRepository {
  private readonly users = new Map<string, UserRecord>();

  async existsByEmail(email: string): Promise<boolean> {
    return [...this.users.values()].some((user) => user.email === email);
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      isActive: false,
    };

    this.users.set(user.id, user);

    return user;
  }

  async activate(userId: string): Promise<void> {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error(`User '${userId}' not found`);
    }

    this.users.set(userId, {
      ...user,
      isActive: true,
    });
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }
}
