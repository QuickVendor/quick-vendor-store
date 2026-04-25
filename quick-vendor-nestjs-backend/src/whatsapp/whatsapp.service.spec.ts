/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserCacheService } from '../auth/user-cache.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFetch(ok: boolean, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: jest.fn().mockResolvedValue(body),
  });
}

async function buildService(apiKey: string) {
  const prisma = {
    user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
  };
  const userCache = { invalidate: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WhatsAppService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 'whatsapp.abstractApiKey') return apiKey;
            return undefined;
          }),
        },
      },
      { provide: UserCacheService, useValue: userCache },
    ],
  }).compile();

  return {
    service: module.get<WhatsAppService>(WhatsAppService),
    prisma: prisma as { user: { update: jest.Mock } },
    userCache: userCache as { invalidate: jest.Mock },
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('WhatsAppService', () => {
  afterEach(() => jest.restoreAllMocks());

  // ── validate ──────────────────────────────────────────────────────────────
  describe('validate', () => {
    it('should return null and skip fetch when API key is not configured', async () => {
      const { service } = await buildService('');
      global.fetch = jest.fn();

      const result = await service.validate('+2348012345678');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return true when Abstract API reports the number as valid', async () => {
      const { service } = await buildService('test-api-key');
      global.fetch = buildFetch(true, { valid: true, phone: '+2348012345678' });

      const result = await service.validate('+2348012345678');

      expect(result).toBe(true);
    });

    it('should return false when Abstract API reports the number as invalid', async () => {
      const { service } = await buildService('test-api-key');
      global.fetch = buildFetch(true, {
        valid: false,
        phone: '+2340000000000',
      });

      const result = await service.validate('+2340000000000');

      expect(result).toBe(false);
    });

    it('should return null when Abstract API returns a non-OK status', async () => {
      const { service } = await buildService('test-api-key');
      global.fetch = buildFetch(false, { message: 'Quota exceeded' });

      const result = await service.validate('+2348012345678');

      expect(result).toBeNull();
    });

    it('should return null when fetch throws a network error', async () => {
      const { service } = await buildService('test-api-key');
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.validate('+2348012345678');

      expect(result).toBeNull();
    });

    it('should normalize a local Nigerian number (leading 0) to +234', async () => {
      const { service } = await buildService('test-api-key');
      const fetchMock = buildFetch(true, { valid: true });
      global.fetch = fetchMock;

      await service.validate('08012345678');

      const url: string = fetchMock.mock.calls[0][0];
      expect(url).toContain(encodeURIComponent('+2348012345678'));
    });

    it('should strip whitespace from the phone number', async () => {
      const { service } = await buildService('test-api-key');
      const fetchMock = buildFetch(true, { valid: true });
      global.fetch = fetchMock;

      await service.validate('+234 801 234 5678');

      const url: string = fetchMock.mock.calls[0][0];
      expect(url).not.toContain(' ');
    });

    it('should include the API key in the request URL', async () => {
      const { service } = await buildService('my-secret-key');
      const fetchMock = buildFetch(true, { valid: true });
      global.fetch = fetchMock;

      await service.validate('+2348012345678');

      const url: string = fetchMock.mock.calls[0][0];
      expect(url).toContain('api_key=my-secret-key');
    });
  });

  // ── validateAndUpdate ─────────────────────────────────────────────────────
  describe('validateAndUpdate', () => {
    it('should update whatsappVerified=true for a valid number', async () => {
      const { service, prisma } = await buildService('key');
      global.fetch = buildFetch(true, { valid: true });

      await service.validateAndUpdate('u1', '+2348012345678');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { whatsappVerified: true },
        }),
      );
    });

    it('should update whatsappVerified=false for an invalid number', async () => {
      const { service, prisma } = await buildService('key');
      global.fetch = buildFetch(true, { valid: false });

      await service.validateAndUpdate('u1', '+2340000000000');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { whatsappVerified: false },
        }),
      );
    });

    it('should invalidate the user cache after updating', async () => {
      const { service, userCache } = await buildService('key');
      global.fetch = buildFetch(true, { valid: true });

      await service.validateAndUpdate('u1', '+2348012345678');

      expect(userCache.invalidate).toHaveBeenCalledWith('u1');
    });

    it('should skip DB update and cache invalidation when validation returns null', async () => {
      const { service, prisma, userCache } = await buildService(''); // no key → skipped

      await service.validateAndUpdate('u1', '+2348012345678');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(userCache.invalidate).not.toHaveBeenCalled();
    });

    it('should skip DB update when API call fails (returns null)', async () => {
      const { service, prisma } = await buildService('key');
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      await service.validateAndUpdate('u1', '+2348012345678');

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
