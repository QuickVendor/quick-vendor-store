import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ───────────────────────────────────────────────
const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'vendor@example.com',
  hashedPassword: 'argon2-hashed-password',
  whatsappNumber: '+2348012345678',
  storeName: 'Test Store',
  storeSlug: 'test-store',
  storeUrl: null,
  bannerUrl: null,
  role: UserRole.VENDOR,
  status: UserStatus.ACTIVE,
  whatsappVerified: null,
  paystackSubaccountCode: null,
  bankCode: null,
  bankAccountNumber: null,
  bankAccountName: null,
  paymentSetupComplete: false,
  suspendedAt: null,
  suspensionReason: null,
  deletedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: null,
};

// ── Test Suite ─────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── validateUser ───────────────────────────────────────
  describe('validateUser', () => {
    it('should return the user when credentials are correct', async () => {
      const realHash = await argon2.hash('correctPassword');
      const user = { ...MOCK_USER, hashedPassword: realHash };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser(
        'vendor@example.com',
        'correctPassword',
      );

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'vendor@example.com' },
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nobody@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const realHash = await argon2.hash('correctPassword');
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        hashedPassword: realHash,
      });

      await expect(
        service.validateUser('vendor@example.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should normalize email to lowercase before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('VENDOR@Example.COM', 'password'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'vendor@example.com' },
      });
    });

    it('should use the same generic message for both wrong email and wrong password', async () => {
      // Non-existent user
      prisma.user.findUnique.mockResolvedValue(null);
      try {
        await service.validateUser('nobody@test.com', 'pwd');
      } catch (e) {
        expect((e as UnauthorizedException).message).toBe(
          'Incorrect email or password',
        );
      }

      // Wrong password
      const realHash = await argon2.hash('correctPassword');
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        hashedPassword: realHash,
      });
      try {
        await service.validateUser('vendor@example.com', 'wrong');
      } catch (e) {
        expect((e as UnauthorizedException).message).toBe(
          'Incorrect email or password',
        );
      }
    });
  });

  // ── generateToken ──────────────────────────────────────
  describe('generateToken', () => {
    it('should call jwtService.sign with sub and email payload', () => {
      service.generateToken(MOCK_USER);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: MOCK_USER.id,
        email: MOCK_USER.email,
        role: MOCK_USER.role,
      });
    });

    it('should return the token string from JwtService', () => {
      const result = service.generateToken(MOCK_USER);
      expect(result).toBe('mock-jwt-token');
    });
  });

  // ── verifyToken ────────────────────────────────────────
  describe('verifyToken', () => {
    it('should return the user when token is valid', async () => {
      jwtService.verify.mockReturnValue({
        sub: MOCK_USER.id,
        email: MOCK_USER.email,
      });
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual(MOCK_USER);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should return null when token verification throws (expired/invalid)', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await service.verifyToken('expired-token');
      expect(result).toBeNull();
    });

    it('should return null when user no longer exists in DB', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'deleted-user-id',
        email: 'deleted@test.com',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.verifyToken('valid-token-deleted-user');
      expect(result).toBeNull();
    });
  });

  // ── refreshToken ───────────────────────────────────────
  describe('refreshToken', () => {
    it('should return a new token for a valid (even expired) token', async () => {
      jwtService.verify.mockReturnValue({
        sub: MOCK_USER.id,
        email: MOCK_USER.email,
      });
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      jwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.refreshToken('old-token');

      expect(result).toBe('new-jwt-token');
      expect(jwtService.verify).toHaveBeenCalledWith('old-token', {
        ignoreExpiration: true,
      });
    });

    it('should return null when token signature is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const result = await service.refreshToken('tampered-token');
      expect(result).toBeNull();
    });

    it('should return null when token payload has no sub', async () => {
      jwtService.verify.mockReturnValue({ email: 'test@test.com' });

      const result = await service.refreshToken('no-sub-token');
      expect(result).toBeNull();
    });

    it('should return null when user has been deleted', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'deleted-id',
        email: 'gone@test.com',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.refreshToken('deleted-user-token');
      expect(result).toBeNull();
    });
  });

  // ── hashPassword ───────────────────────────────────────
  describe('hashPassword', () => {
    it('should return a hash different from the input', async () => {
      const hash = await service.hashPassword('myPassword123');
      expect(hash).not.toBe('myPassword123');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce a hash that argon2.verify accepts', async () => {
      const hash = await service.hashPassword('testPassword');
      const isValid = await argon2.verify(hash, 'testPassword');
      expect(isValid).toBe(true);
    });

    it('should produce different hashes for the same input (salted)', async () => {
      const hash1 = await service.hashPassword('samePassword');
      const hash2 = await service.hashPassword('samePassword');
      expect(hash1).not.toBe(hash2);
    });
  });
});
