import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

/**
 * In-memory per-instance cache for the authenticated user record.
 * Shared between JwtStrategy (populates + reads on every request) and
 * UsersService (invalidates whenever a user mutation writes to the DB,
 * so the next authenticated request sees the fresh record).
 */
@Injectable()
export class UserCacheService {
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly entries = new Map<
    string,
    { user: User; expiresAt: number }
  >();

  get(userId: string): User | null {
    const entry = this.entries.get(userId);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(userId);
      return null;
    }
    return entry.user;
  }

  set(user: User): void {
    this.entries.set(user.id, {
      user,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidate(userId: string): void {
    this.entries.delete(userId);
  }
}
