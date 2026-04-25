/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Mock uuid (ESM-only) before any imports that transitively depend on it
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

// ── Fixtures ───────────────────────────────────────────────
const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-other';

const MOCK_PRODUCT = {
  id: 'product-uuid-1',
  name: 'Premium T-Shirt',
  description: 'A quality cotton t-shirt',
  price: 2500,
  imageUrl1: null as string | null,
  imageUrl2: null as string | null,
  imageUrl3: null as string | null,
  imageUrl4: null as string | null,
  isAvailable: true,
  clickCount: 0,
  userId: USER_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: null,
};

function mockFile(name = 'image.jpg'): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };
}

// ── Test Suite ─────────────────────────────────────────────
describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let storageService: {
    uploadProductImage: jest.Mock;
    deleteFile: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    storageService = {
      uploadProductImage: jest.fn().mockResolvedValue({
        url: 'https://s3.example.com/img.jpg',
        key: 'product-images/product-uuid-1/img.jpg',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  // ── create ─────────────────────────────────────────────
  describe('create', () => {
    it('should create a product without images', async () => {
      prisma.product.create.mockResolvedValue(MOCK_PRODUCT);

      const result = await service.create(
        USER_ID,
        { name: 'Test', price: 1000 },
        [],
      );

      expect(result).toEqual(MOCK_PRODUCT);
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test',
          price: 1000,
          userId: USER_ID,
        }),
      });
    });

    it('should upload images to slots 1-N', async () => {
      prisma.product.create.mockResolvedValue(MOCK_PRODUCT);
      const updatedProduct = {
        ...MOCK_PRODUCT,
        imageUrl1: 'https://s3.example.com/img.jpg',
      };
      prisma.product.update.mockResolvedValue(updatedProduct);

      const files = [mockFile('photo1.jpg')];
      const result = await service.create(
        USER_ID,
        { name: 'Test', price: 1000 },
        files,
      );

      expect(storageService.uploadProductImage).toHaveBeenCalledTimes(1);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: MOCK_PRODUCT.id },
        data: expect.objectContaining({ imageUrl1: expect.any(String) }),
      });
      expect(result).toEqual(updatedProduct);
    });

    it('should cap image uploads to a maximum of 5', async () => {
      prisma.product.create.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      const files = Array.from({ length: 7 }, (_, i) =>
        mockFile(`photo${i + 1}.jpg`),
      );
      await service.create(USER_ID, { name: 'Test', price: 1000 }, files);

      // Only 5 uploads despite 7 files
      expect(storageService.uploadProductImage).toHaveBeenCalledTimes(5);
    });

    it('should set isAvailable to true by default', async () => {
      prisma.product.create.mockResolvedValue(MOCK_PRODUCT);

      await service.create(USER_ID, { name: 'Test', price: 500 }, []);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isAvailable: true }),
      });
    });

    it('should allow setting isAvailable to false', async () => {
      prisma.product.create.mockResolvedValue({
        ...MOCK_PRODUCT,
        isAvailable: false,
      });

      await service.create(
        USER_ID,
        { name: 'Test', price: 500, is_available: false },
        [],
      );

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isAvailable: false }),
      });
    });

    it('should store null description when not provided', async () => {
      prisma.product.create.mockResolvedValue(MOCK_PRODUCT);

      await service.create(USER_ID, { name: 'Test', price: 500 }, []);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: null }),
      });
    });
  });

  // ── findAllByUser ──────────────────────────────────────
  describe('findAllByUser', () => {
    it('should return all products for the user', async () => {
      const products = [MOCK_PRODUCT, { ...MOCK_PRODUCT, id: 'product-2' }];
      prisma.product.findMany.mockResolvedValue(products);

      const result = await service.findAllByUser(USER_ID);

      expect(result).toHaveLength(2);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no products', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser(USER_ID);
      expect(result).toEqual([]);
    });
  });

  // ── findOneByUser ──────────────────────────────────────
  describe('findOneByUser', () => {
    it('should return the product when it belongs to the user', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);

      const result = await service.findOneByUser('product-uuid-1', USER_ID);
      expect(result).toEqual(MOCK_PRODUCT);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneByUser('non-existent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when product belongs to another user', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);

      await expect(
        service.findOneByUser('product-uuid-1', OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── update ─────────────────────────────────────────────
  describe('update', () => {
    it('should update text fields without touching images', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.update.mockResolvedValue({
        ...MOCK_PRODUCT,
        name: 'Updated Name',
        price: 3000,
      });

      const result = await service.update('product-uuid-1', USER_ID, {
        name: 'Updated Name',
        price: 3000,
      });

      expect(result.name).toBe('Updated Name');
      expect(storageService.uploadProductImage).not.toHaveBeenCalled();
    });

    it('should upload new images and delete old ones', async () => {
      const productWithImages = {
        ...MOCK_PRODUCT,
        imageUrl1:
          'https://bucket.s3.region.amazonaws.com/product-images/old.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(productWithImages);
      prisma.product.update.mockResolvedValue({
        ...MOCK_PRODUCT,
        imageUrl1: 'https://s3.example.com/img.jpg',
      });

      await service.update('product-uuid-1', USER_ID, {}, [mockFile()]);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'product-images/old.jpg',
      );
      expect(storageService.uploadProductImage).toHaveBeenCalledTimes(1);
    });

    it('should clear unused image slots when fewer new images are uploaded', async () => {
      const productWithImages = {
        ...MOCK_PRODUCT,
        imageUrl1:
          'https://bucket.s3.region.amazonaws.com/product-images/img1.jpg',
        imageUrl2:
          'https://bucket.s3.region.amazonaws.com/product-images/img2.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(productWithImages);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      await service.update('product-uuid-1', USER_ID, {}, [mockFile()]);

      // Should write null to slots 2-5
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: expect.objectContaining({
          imageUrl2: null,
          imageUrl3: null,
          imageUrl4: null,
        }),
      });
    });

    it('should throw ForbiddenException when product belongs to another user', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);

      await expect(
        service.update('product-uuid-1', OTHER_USER_ID, { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── remove ─────────────────────────────────────────────
  describe('remove', () => {
    it('should delete the product and its images', async () => {
      const productWithImages = {
        ...MOCK_PRODUCT,
        imageUrl1:
          'https://bucket.s3.region.amazonaws.com/product-images/img1.jpg',
        imageUrl2:
          'https://bucket.s3.region.amazonaws.com/product-images/img2.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(productWithImages);
      prisma.product.delete.mockResolvedValue(productWithImages);

      await service.remove('product-uuid-1', USER_ID);

      expect(storageService.deleteFile).toHaveBeenCalledTimes(2);
      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
      });
    });

    it('should throw ForbiddenException when product belongs to another user', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);

      await expect(
        service.remove('product-uuid-1', OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle product with no images gracefully', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.delete.mockResolvedValue(MOCK_PRODUCT);

      await service.remove('product-uuid-1', USER_ID);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });
  });

  // ── trackClick ─────────────────────────────────────────
  describe('trackClick', () => {
    it('should increment click count and return new value', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.update.mockResolvedValue({
        ...MOCK_PRODUCT,
        clickCount: 1,
      });

      const result = await service.trackClick('product-uuid-1');

      expect(result).toEqual({ click_count: 1 });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { clickCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.trackClick('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── uploadImageToSlot ──────────────────────────────────
  describe('uploadImageToSlot', () => {
    it('should upload image to the specified slot (1-5)', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      const result = await service.uploadImageToSlot(
        'product-uuid-1',
        USER_ID,
        3,
        mockFile(),
      );

      expect(result).toEqual({
        url: 'https://s3.example.com/img.jpg',
        key: 'product-images/product-uuid-1/img.jpg',
        slot: 3,
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { imageUrl3: 'https://s3.example.com/img.jpg' },
      });
    });

    it('should delete existing image in the slot before uploading', async () => {
      const productWithImage = {
        ...MOCK_PRODUCT,
        imageUrl2:
          'https://bucket.s3.region.amazonaws.com/product-images/existing.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(productWithImage);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      await service.uploadImageToSlot('product-uuid-1', USER_ID, 2, mockFile());

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'product-images/existing.jpg',
      );
    });

    it('should throw BadRequestException for slot 0', async () => {
      await expect(
        service.uploadImageToSlot('product-uuid-1', USER_ID, 0, mockFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for slot 6', async () => {
      await expect(
        service.uploadImageToSlot('product-uuid-1', USER_ID, 6, mockFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative slot', async () => {
      await expect(
        service.uploadImageToSlot('product-uuid-1', USER_ID, -1, mockFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when product belongs to another user', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);

      await expect(
        service.uploadImageToSlot(
          'product-uuid-1',
          OTHER_USER_ID,
          1,
          mockFile(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── deleteImageFromSlot ────────────────────────────────
  describe('deleteImageFromSlot', () => {
    it('should delete the image and clear the slot', async () => {
      const productWithImage = {
        ...MOCK_PRODUCT,
        imageUrl1:
          'https://bucket.s3.region.amazonaws.com/product-images/to-delete.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(productWithImage);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      await service.deleteImageFromSlot('product-uuid-1', USER_ID, 1);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'product-images/to-delete.jpg',
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { imageUrl1: null },
      });
    });

    it('should handle empty slot gracefully (no storage call)', async () => {
      prisma.product.findUnique.mockResolvedValue(MOCK_PRODUCT);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      await service.deleteImageFromSlot('product-uuid-1', USER_ID, 3);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for slot 0', async () => {
      await expect(
        service.deleteImageFromSlot('product-uuid-1', USER_ID, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for slot 6', async () => {
      await expect(
        service.deleteImageFromSlot('product-uuid-1', USER_ID, 6),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle local URL extraction', async () => {
      const product = {
        ...MOCK_PRODUCT,
        imageUrl4: 'http://localhost:3000/uploads/product-images/local.jpg',
      };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue(MOCK_PRODUCT);

      await service.deleteImageFromSlot('product-uuid-1', USER_ID, 4);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'product-images/local.jpg',
      );
    });
  });
});
