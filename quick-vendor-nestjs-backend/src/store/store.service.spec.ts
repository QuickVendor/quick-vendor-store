import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ───────────────────────────────────────────────
const MOCK_PRODUCT_AVAILABLE = {
  id: 'product-1',
  name: 'Available Shirt',
  description: 'A shirt',
  price: 2000,
  imageUrl1: 'https://s3.example.com/img1.jpg',
  imageUrl2: 'https://s3.example.com/img2.jpg',
  imageUrl3: null,
  imageUrl4: null,
  isAvailable: true,
  clickCount: 5,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: null,
};

const MOCK_PRODUCT_UNAVAILABLE = {
  ...MOCK_PRODUCT_AVAILABLE,
  id: 'product-2',
  name: 'Hidden Product',
  isAvailable: false,
};

const MOCK_USER_WITH_PRODUCTS = {
  id: 'user-1',
  email: 'vendor@example.com',
  hashedPassword: 'hashed',
  whatsappNumber: '+2348012345678',
  storeName: 'Test Store',
  storeSlug: 'test-store',
  storeUrl: null,
  bannerUrl: 'https://s3.example.com/banner.jpg',
  createdAt: new Date(),
  updatedAt: null,
  products: [MOCK_PRODUCT_AVAILABLE, MOCK_PRODUCT_UNAVAILABLE],
};

// ── Test Suite ─────────────────────────────────────────────
describe('StoreService', () => {
  let service: StoreService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StoreService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  // ── getStorefront ──────────────────────────────────────
  describe('getStorefront', () => {
    it('should find store by slug', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('test-store');

      expect(result.store_name).toBe('Test Store');
      expect(result.store_slug).toBe('test-store');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { storeSlug: 'test-store' },
        include: { products: true },
      });
    });

    it('should fall back to email prefix search when slug not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // No slug match
      prisma.user.findFirst.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('vendor');

      expect(result.vendor_email).toBe('vendor@example.com');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { startsWith: 'vendor' } },
        include: { products: true },
      });
    });

    it('should throw NotFoundException when neither slug nor email matches', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getStorefront('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only include available products in the response', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('test-store');

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Available Shirt');
      expect(result.products[0].is_available).toBe(true);
    });

    it('should collect non-null image URLs into image_urls array', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('test-store');
      const product = result.products[0];

      expect(product.image_urls).toEqual([
        'https://s3.example.com/img1.jpg',
        'https://s3.example.com/img2.jpg',
      ]);
    });

    it('should return empty image_urls array when product has no images', async () => {
      const userWithNoImageProduct = {
        ...MOCK_USER_WITH_PRODUCTS,
        products: [
          {
            ...MOCK_PRODUCT_AVAILABLE,
            imageUrl1: null,
            imageUrl2: null,
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(userWithNoImageProduct);

      const result = await service.getStorefront('test-store');

      expect(result.products[0].image_urls).toEqual([]);
    });

    it('should return the complete DTO shape', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('test-store');

      expect(result).toEqual(
        expect.objectContaining({
          store_name: expect.any(String),
          store_slug: expect.any(String),
          banner_url: expect.any(String),
          vendor_email: expect.any(String),
          whatsapp_number: expect.any(String),
          products: expect.any(Array),
        }),
      );
    });

    it('should include click_count in public product DTO', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER_WITH_PRODUCTS);

      const result = await service.getStorefront('test-store');

      expect(result.products[0].click_count).toBe(5);
    });

    it('should normalize email prefix to lowercase for lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getStorefront('VENDOR')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { startsWith: 'vendor' } },
        include: { products: true },
      });
    });

    it('should return empty products array when user has no available products', async () => {
      const userNoProducts = {
        ...MOCK_USER_WITH_PRODUCTS,
        products: [MOCK_PRODUCT_UNAVAILABLE],
      };
      prisma.user.findUnique.mockResolvedValue(userNoProducts);

      const result = await service.getStorefront('test-store');

      expect(result.products).toEqual([]);
    });

    it('should collect all 5 image URLs when all slots are filled', async () => {
      const fullImageProduct = {
        ...MOCK_PRODUCT_AVAILABLE,
        imageUrl1: 'url1',
        imageUrl2: 'url2',
        imageUrl3: 'url3',
        imageUrl4: 'url4',
        imageUrl5: 'url5',
      };
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER_WITH_PRODUCTS,
        products: [fullImageProduct],
      });

      const result = await service.getStorefront('test-store');

      expect(result.products[0].image_urls).toEqual([
        'url1',
        'url2',
        'url3',
        'url4',
        'url5',
      ]);
    });
  });
});
