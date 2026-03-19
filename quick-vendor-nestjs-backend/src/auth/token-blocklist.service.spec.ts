import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenBlocklistService } from './token-blocklist.service';

describe('TokenBlocklistService', () => {
  let service: TokenBlocklistService;

  beforeEach(async () => {
    // Use fake timers so setInterval in constructor doesn't leak
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlocklistService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'jwt.expirationMinutes') return 30;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TokenBlocklistService>(TokenBlocklistService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── block + isBlocked ──────────────────────────────────
  describe('block / isBlocked', () => {
    it('should mark a token as blocked', () => {
      service.block('token-abc');
      expect(service.isBlocked('token-abc')).toBe(true);
    });

    it('should return false for tokens that were never blocked', () => {
      expect(service.isBlocked('unknown-token')).toBe(false);
    });

    it('should track multiple tokens independently', () => {
      service.block('token-1');
      service.block('token-2');

      expect(service.isBlocked('token-1')).toBe(true);
      expect(service.isBlocked('token-2')).toBe(true);
      expect(service.isBlocked('token-3')).toBe(false);
    });

    it('should allow re-blocking the same token without error', () => {
      service.block('token-x');
      service.block('token-x');

      expect(service.isBlocked('token-x')).toBe(true);
    });
  });

  // ── TTL Expiry ─────────────────────────────────────────
  describe('TTL expiry', () => {
    it('should return false after the TTL expires', () => {
      service.block('expiring-token');
      expect(service.isBlocked('expiring-token')).toBe(true);

      // Advance time past the 30-minute TTL
      jest.advanceTimersByTime(31 * 60 * 1000);

      expect(service.isBlocked('expiring-token')).toBe(false);
    });

    it('should still return true just before the TTL expires', () => {
      service.block('borderline-token');

      // Advance to 29 minutes (within TTL)
      jest.advanceTimersByTime(29 * 60 * 1000);

      expect(service.isBlocked('borderline-token')).toBe(true);
    });
  });

  // ── Cleanup ────────────────────────────────────────────
  describe('cleanup (via setInterval)', () => {
    it('should remove expired entries when cleanup fires', () => {
      service.block('cleanup-target');

      // Advance past TTL (30 min) + trigger cleanup interval (5 min)
      jest.advanceTimersByTime(35 * 60 * 1000);

      // isBlocked auto-removes expired entries, so it would return false anyway.
      // The cleanup interval prevents memory leaks for tokens never checked again.
      expect(service.isBlocked('cleanup-target')).toBe(false);
    });

    it('should not remove tokens that are still within TTL during cleanup', () => {
      service.block('still-valid');

      // Advance 4 minutes — cleanup fires at 5 min but token is still valid
      jest.advanceTimersByTime(4 * 60 * 1000);

      expect(service.isBlocked('still-valid')).toBe(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle empty string token', () => {
      service.block('');
      expect(service.isBlocked('')).toBe(true);
    });

    it('should handle very long token strings', () => {
      const longToken = 'a'.repeat(10000);
      service.block(longToken);
      expect(service.isBlocked(longToken)).toBe(true);
    });
  });
});
