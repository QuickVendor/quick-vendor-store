import { UserCacheService } from './user-cache.service';
import type { User } from '@prisma/client';

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeUser(id: string): User {
  return {
    id,
    email: `${id}@test.com`,
    hashedPassword: 'hash',
    whatsappNumber: '+2348000000000',
    whatsappVerified: null,
    storeName: null,
    storeSlug: null,
    bannerUrl: null,
    role: 'VENDOR',
    status: 'ACTIVE',
    paystackSubaccountCode: null,
    bankCode: null,
    bankAccountNumber: null,
    bankAccountName: null,
    paymentSetupComplete: false,
    suspendedAt: null,
    suspensionReason: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('UserCacheService', () => {
  let cache: UserCacheService;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new UserCacheService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── set / get ─────────────────────────────────────────────────────────────
  describe('set / get', () => {
    it('should store and retrieve a user', () => {
      const user = makeUser('u1');
      cache.set(user);
      expect(cache.get('u1')).toEqual(user);
    });

    it('should return null for an unknown userId', () => {
      expect(cache.get('nobody')).toBeNull();
    });

    it('should store multiple users independently', () => {
      const u1 = makeUser('u1');
      const u2 = makeUser('u2');
      cache.set(u1);
      cache.set(u2);

      expect(cache.get('u1')).toEqual(u1);
      expect(cache.get('u2')).toEqual(u2);
    });

    it('should overwrite an existing entry on second set', () => {
      const original = makeUser('u1');
      cache.set(original);

      const updated = { ...original, storeName: 'Updated Store' } as User;
      cache.set(updated);

      expect(cache.get('u1')?.storeName).toBe('Updated Store');
    });
  });

  // ── TTL expiry ─────────────────────────────────────────────────────────────
  describe('TTL expiry (5 minutes)', () => {
    it('should return the user before TTL expires', () => {
      const user = makeUser('u1');
      cache.set(user);

      jest.advanceTimersByTime(4 * 60 * 1000 + 59_000); // 4m59s

      expect(cache.get('u1')).toEqual(user);
    });

    it('should return null after TTL expires (≥5 minutes)', () => {
      const user = makeUser('u1');
      cache.set(user);

      jest.advanceTimersByTime(5 * 60 * 1000); // exactly at TTL boundary

      expect(cache.get('u1')).toBeNull();
    });

    it('should auto-remove the expired entry from the map on get', () => {
      const user = makeUser('u1');
      cache.set(user);

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      cache.get('u1'); // triggers delete
      cache.get('u1'); // second call — should still be null, not throw

      expect(cache.get('u1')).toBeNull();
    });

    it('re-setting a user after TTL should work', () => {
      const user = makeUser('u1');
      cache.set(user);

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(cache.get('u1')).toBeNull();

      cache.set(user); // re-cache
      expect(cache.get('u1')).toEqual(user);
    });
  });

  // ── invalidate ────────────────────────────────────────────────────────────
  describe('invalidate', () => {
    it('should immediately remove the entry', () => {
      const user = makeUser('u1');
      cache.set(user);

      cache.invalidate('u1');

      expect(cache.get('u1')).toBeNull();
    });

    it('should not throw when invalidating an entry that does not exist', () => {
      expect(() => cache.invalidate('phantom')).not.toThrow();
    });

    it('should only remove the targeted user, not others', () => {
      const u1 = makeUser('u1');
      const u2 = makeUser('u2');
      cache.set(u1);
      cache.set(u2);

      cache.invalidate('u1');

      expect(cache.get('u1')).toBeNull();
      expect(cache.get('u2')).toEqual(u2);
    });
  });
});
