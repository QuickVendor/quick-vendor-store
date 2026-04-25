/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Mock uuid (ESM-only) before any imports that transitively depend on it
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserCacheService } from '../auth/user-cache.service';
import { StorageService } from '../storage/storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

// ── Fixtures ───────────────────────────────────────────────
const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'vendor@example.com',
  hashedPassword: 'argon2-hashed',
  whatsappNumber: '+2348012345678',
  storeName: 'Test Store',
  storeSlug: 'test-store',
  storeUrl: null,
  bannerUrl: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: null,
};

const MOCK_MULTER_FILE: Express.Multer.File = {
  fieldname: 'banner',
  originalname: 'banner.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('fake-image-data'),
  destination: '',
  filename: '',
  path: '',
  stream: null as any,
};

// ── Test Suite ─────────────────────────────────────────────
describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let authService: { hashPassword: jest.Mock };
  let userCache: { invalidate: jest.Mock; get: jest.Mock; set: jest.Mock };
  let storageService: {
    uploadStoreBanner: jest.Mock;
    deleteFile: jest.Mock;
  };
  let whatsApp: { validateAndUpdate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    authService = {
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
    };

    userCache = {
      invalidate: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    storageService = {
      uploadStoreBanner: jest.fn().mockResolvedValue({
        url: 'https://s3.example.com/banner.jpg',
        key: 'store-banners/user-uuid-1/banner.jpg',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    whatsApp = {
      validateAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: UserCacheService, useValue: userCache },
        { provide: StorageService, useValue: storageService },
        { provide: WhatsAppService, useValue: whatsApp },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ── register ───────────────────────────────────────────
  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(MOCK_USER);

      const result = await service.register({
        email: 'vendor@example.com',
        password: 'strongPassword123',
      });

      expect(result).toEqual(MOCK_USER);
      expect(authService.hashPassword).toHaveBeenCalledWith(
        'strongPassword123',
      );
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'vendor@example.com',
          hashedPassword: 'hashed-password',
        }),
      });
    });

    it('should throw ConflictException when email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      await expect(
        service.register({
          email: 'vendor@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize email to lowercase', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(MOCK_USER);

      await service.register({
        email: 'VENDOR@EXAMPLE.COM',
        password: 'password123',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'vendor@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'vendor@example.com',
        }),
      });
    });

    it('should set whatsapp_number to empty string when not provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(MOCK_USER);

      await service.register({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          whatsappNumber: '',
        }),
      });
    });

    it('should store optional store_name when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(MOCK_USER);

      await service.register({
        email: 'test@test.com',
        password: 'password123',
        store_name: 'My Shop',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeName: 'My Shop',
        }),
      });
    });

    it('should set storeName to null when not provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(MOCK_USER);

      await service.register({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeName: null,
        }),
      });
    });
  });

  // ── getProfile ─────────────────────────────────────────
  describe('getProfile', () => {
    it('should return the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);

      const result = await service.getProfile('user-uuid-1');

      expect(result).toEqual(MOCK_USER);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateStore ────────────────────────────────────────
  describe('updateStore', () => {
    it('should update store name', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // No slug conflict
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        storeName: 'New Store Name',
      });

      const result = await service.updateStore('user-uuid-1', {
        store_name: 'New Store Name',
      });

      expect(result.storeName).toBe('New Store Name');
    });

    it('should update store slug when no conflict exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        storeSlug: 'new-slug',
      });

      const result = await service.updateStore('user-uuid-1', {
        store_slug: 'new-slug',
      });

      expect(result.storeSlug).toBe('new-slug');
    });

    it('should throw ConflictException when slug is taken by another user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        id: 'other-user-id',
      });

      await expect(
        service.updateStore('user-uuid-1', { store_slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow user to keep their own slug', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER); // Same user owns slug
      prisma.user.update.mockResolvedValue(MOCK_USER);

      await expect(
        service.updateStore('user-uuid-1', { store_slug: 'test-store' }),
      ).resolves.not.toThrow();
    });

    it('should skip slug uniqueness check when slug is not being updated', async () => {
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        storeName: 'Updated',
      });

      await service.updateStore('user-uuid-1', { store_name: 'Updated' });

      // findUnique should NOT be called for slug check
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── uploadBanner ───────────────────────────────────────
  describe('uploadBanner', () => {
    it('should upload banner and update user record', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: 'https://s3.example.com/banner.jpg',
      });

      const result = await service.uploadBanner(
        'user-uuid-1',
        MOCK_MULTER_FILE,
      );

      expect(storageService.uploadStoreBanner).toHaveBeenCalledWith(
        MOCK_MULTER_FILE.buffer,
        MOCK_MULTER_FILE.originalname,
        'user-uuid-1',
        MOCK_MULTER_FILE.mimetype,
      );
      expect(result.bannerUrl).toBe('https://s3.example.com/banner.jpg');
    });

    it('should delete existing banner before uploading new one', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl:
          'https://bucket.s3.region.amazonaws.com/store-banners/old.jpg',
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: 'https://s3.example.com/banner.jpg',
      });

      await service.uploadBanner('user-uuid-1', MOCK_MULTER_FILE);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'store-banners/old.jpg',
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadBanner('non-existent', MOCK_MULTER_FILE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteBanner ───────────────────────────────────────
  describe('deleteBanner', () => {
    it('should clear bannerUrl and delete the file', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl:
          'https://bucket.s3.region.amazonaws.com/store-banners/banner.jpg',
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });

      const result = await service.deleteBanner('user-uuid-1');

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'store-banners/banner.jpg',
      );
      expect(result.bannerUrl).toBeNull();
    });

    it('should handle user with no existing banner gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });

      const result = await service.deleteBanner('user-uuid-1');

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(result.bannerUrl).toBeNull();
    });

    it('should handle local upload URL extraction', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl:
          'http://localhost:3000/uploads/store-banners/local-banner.jpg',
      });
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });

      await service.deleteBanner('user-uuid-1');

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'store-banners/local-banner.jpg',
      );
    });

    it('should not throw when storage deletion fails', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: 'https://bucket.s3.region.amazonaws.com/store-banners/b.jpg',
      });
      storageService.deleteFile.mockRejectedValue(new Error('S3 error'));
      prisma.user.update.mockResolvedValue({
        ...MOCK_USER,
        bannerUrl: null,
      });

      // Should not throw — deletion failure is swallowed
      await expect(service.deleteBanner('user-uuid-1')).resolves.not.toThrow();
    });
  });
});
