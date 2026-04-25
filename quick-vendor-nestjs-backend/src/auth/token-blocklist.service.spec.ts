import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenBlocklistService } from './token-blocklist.service';

// Use in-memory path (no Redis URL) throughout all tests.
const configGet = jest.fn().mockImplementation((key: string) => {
  if (key === 'jwt.expirationMinutes') return 30;
  if (key === 'redis.url') return ''; // falsy → in-memory fallback
  return undefined;
});

describe('TokenBlocklistService', () => {
  let service: TokenBlocklistService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlocklistService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<TokenBlocklistService>(TokenBlocklistService);
    // Trigger lifecycle hook (NestJS calls this automatically in real app)
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ── block / isBlocked ─────────────────────────────────────
  describe('block / isBlocked', () => {
    it('should mark a token as blocked', async () => {
      await service.block('token-abc');
      expect(await service.isBlocked('token-abc')).toBe(true);
    });

    it('should return false for tokens that were never blocked', async () => {
      expect(await service.isBlocked('unknown-token')).toBe(false);
    });

    it('should track multiple tokens independently', async () => {
      await service.block('token-1');
      await service.block('token-2');

      expect(await service.isBlocked('token-1')).toBe(true);
      expect(await service.isBlocked('token-2')).toBe(true);
      expect(await service.isBlocked('token-3')).toBe(false);
    });

    it('should allow re-blocking the same token without error', async () => {
      await service.block('token-x');
      await service.block('token-x');

      expect(await service.isBlocked('token-x')).toBe(true);
    });
  });

  // ── TTL expiry ─────────────────────────────────────────────
  describe('TTL expiry', () => {
    it('should return false after the TTL expires', async () => {
      await service.block('expiring-token');
      expect(await service.isBlocked('expiring-token')).toBe(true);

      jest.advanceTimersByTime(31 * 60 * 1000); // past 30-min TTL

      expect(await service.isBlocked('expiring-token')).toBe(false);
    });

    it('should still return true just before the TTL expires', async () => {
      await service.block('borderline-token');

      jest.advanceTimersByTime(29 * 60 * 1000); // 1 minute before expiry

      expect(await service.isBlocked('borderline-token')).toBe(true);
    });

    it('should still be blocked at the exact TTL boundary (expiry check is strict >)', async () => {
      await service.block('exact-boundary-token');

      // At exactly TTL ms, Date.now() === expiresAt so > is false → still valid
      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(await service.isBlocked('exact-boundary-token')).toBe(true);

      // One millisecond past → now expired
      jest.advanceTimersByTime(1);
      expect(await service.isBlocked('exact-boundary-token')).toBe(false);
    });
  });

  // ── setInterval cleanup ────────────────────────────────────
  describe('cleanup (via setInterval)', () => {
    it('should remove expired entries when cleanup fires', async () => {
      await service.block('cleanup-target');

      // Advance past TTL (30 min) + cleanup interval (5 min)
      jest.advanceTimersByTime(35 * 60 * 1000);

      expect(await service.isBlocked('cleanup-target')).toBe(false);
    });

    it('should not remove tokens that are still within TTL during cleanup', async () => {
      await service.block('still-valid');

      // 4 minutes — cleanup fires at 5 min but token lives for 30 min
      jest.advanceTimersByTime(4 * 60 * 1000);

      expect(await service.isBlocked('still-valid')).toBe(true);
    });

    it('should survive cleanup of an empty blocklist without throwing', () => {
      expect(() => jest.advanceTimersByTime(5 * 60 * 1000)).not.toThrow();
    });
  });

  // ── edge cases ─────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle empty string token', async () => {
      await service.block('');
      expect(await service.isBlocked('')).toBe(true);
    });

    it('should handle very long token strings', async () => {
      const longToken = 'a'.repeat(10_000);
      await service.block(longToken);
      expect(await service.isBlocked(longToken)).toBe(true);
    });

    it('should handle tokens with special characters', async () => {
      const token = 'eyJhbGciOiJSUzI1Ni.payload.signature==+/';
      await service.block(token);
      expect(await service.isBlocked(token)).toBe(true);
    });

    it('should treat different tokens as independent even if similar', async () => {
      await service.block('abc');
      expect(await service.isBlocked('ab')).toBe(false);
      expect(await service.isBlocked('abcd')).toBe(false);
    });
  });
});
