/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
jest.mock('uuid', () => ({ v4: () => 'aaaabbbb-cccc-dddd-eeee-ffffabcd1234' }));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VENDOR = {
  id: 'vendor-1',
  email: 'vendor@test.com',
  storeName: 'My Store',
  storeSlug: 'my-store',
  paystackSubaccountCode: 'ACCT_test',
  paymentSetupComplete: true,
};

const PRODUCT = {
  id: 'product-1',
  name: 'Test Shirt',
  price: 2500, // 2500 kobo = ₦25
  isAvailable: true,
  owner: VENDOR,
};

function makeOrder(status: string, overrides = {}) {
  return {
    id: 'order-1',
    reference: 'QV-AAAABBBBCCCCDDDD',
    vendorId: 'vendor-1',
    productId: 'product-1',
    status,
    amount: 2500,
    quantity: 1,
    customerEmail: 'buyer@test.com',
    customerName: 'Alice',
    customerPhone: null,
    paidAt: null,
    confirmedAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    product: {
      id: 'product-1',
      name: 'Test Shirt',
      price: 2500,
      imageUrl1: null,
    },
    ...overrides,
  };
}

function buildFetch(ok: boolean, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    product: { findUnique: jest.Mock };
    order: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'paystack.secretKey') return 'sk_test_abc';
              if (key === 'frontendUrls') return ['http://localhost:3001'];
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ── createOrder ─────────────────────────────────────────────────────────────
  describe('createOrder', () => {
    const dto = {
      productId: 'product-1',
      quantity: 2,
      customerName: 'Alice',
      customerEmail: 'alice@test.com',
    };

    it('should create an order and return reference + authorization URL', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      global.fetch = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/abc',
          access_code: 'access',
          reference: 'QV-AAAABBBBCCCCDDDD',
        },
      });

      const result = await service.createOrder(dto);

      expect(result.authorizationUrl).toBe('https://paystack.com/pay/abc');
      expect(result.reference).toMatch(/^QV-/);
    });

    it('should calculate amount as price × quantity (kobo)', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      global.fetch = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/x',
          access_code: 'x',
          reference: 'r',
        },
      });

      await service.createOrder({ ...dto, quantity: 3 });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: PRODUCT.price * 3 }),
        }),
      );
    });

    it('should pass the vendor subaccount code to Paystack', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      const fetchMock = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/x',
          access_code: 'x',
          reference: 'r',
        },
      });
      global.fetch = fetchMock;

      await service.createOrder(dto);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.subaccount).toBe('ACCT_test');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when product is unavailable', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...PRODUCT,
        isAvailable: false,
      });

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when vendor payment is not set up', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...PRODUCT,
        owner: { ...VENDOR, paymentSetupComplete: false },
      });

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when Paystack initialization fails', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      global.fetch = buildFetch(false, { message: 'Paystack error' });

      await expect(service.createOrder(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should build the callback URL with store slug', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      const fetchMock = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/x',
          access_code: 'x',
          reference: 'r',
        },
      });
      global.fetch = fetchMock;

      await service.createOrder(dto);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.callback_url).toContain('my-store');
      expect(body.callback_url).toContain('product-1');
      expect(body.callback_url).toContain('checkout/confirm');
    });

    it('should build callback_url as a valid absolute URL (not comma-joined)', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      const fetchMock = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/x',
          access_code: 'x',
          reference: 'r',
        },
      });
      global.fetch = fetchMock;

      await service.createOrder(dto);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.callback_url).not.toContain(',');
      expect(() => new URL(body.callback_url)).not.toThrow();
    });

    it('should propagate the Paystack error message when initialization fails', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      global.fetch = buildFetch(false, { message: 'Invalid subaccount code' });

      await expect(service.createOrder(dto)).rejects.toThrow(
        'Invalid subaccount code',
      );
    });

    it('should omit subaccount from Paystack request when paystackSubaccountCode is null', async () => {
      const productWithNoSubaccount = {
        ...PRODUCT,
        owner: { ...VENDOR, paystackSubaccountCode: null },
      };
      prisma.product.findUnique.mockResolvedValue(productWithNoSubaccount);
      prisma.order.create.mockResolvedValue(makeOrder('PENDING'));
      const fetchMock = buildFetch(true, {
        data: {
          authorization_url: 'https://paystack.com/pay/x',
          access_code: 'x',
          reference: 'r',
        },
      });
      global.fetch = fetchMock;

      await service.createOrder(dto);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty('subaccount');
    });
  });

  // ── verifyOrder ─────────────────────────────────────────────────────────────
  describe('verifyOrder', () => {
    it('should return order status and DTO', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PAID'));

      const result = await service.verifyOrder('QV-AAAABBBBCCCCDDDD');

      expect(result.status).toBe('PAID');
      expect(result.order).not.toBeNull();
    });

    it('should throw NotFoundException for unknown reference', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.verifyOrder('QV-UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getVendorOrders ──────────────────────────────────────────────────────────
  describe('getVendorOrders', () => {
    it('should return mapped OrderResponseDTOs', async () => {
      prisma.order.findMany.mockResolvedValue([
        makeOrder('PAID'),
        makeOrder('PENDING'),
      ]);

      const result = await service.getVendorOrders('vendor-1');

      expect(result).toHaveLength(2);
    });

    it('should apply pagination (skip/take)', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.getVendorOrders('vendor-1', 3, 10);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── getVendorOrder ───────────────────────────────────────────────────────────
  describe('getVendorOrder', () => {
    it('should return the order when it belongs to the vendor', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PAID'));

      const result = await service.getVendorOrder('order-1', 'vendor-1');

      expect(result.status).toBe('PAID');
    });

    it('should throw ForbiddenException when order belongs to a different vendor', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...makeOrder('PAID'),
        vendorId: 'other-vendor',
      });

      await expect(
        service.getVendorOrder('order-1', 'vendor-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getVendorOrder('ghost', 'vendor-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Order status transitions ─────────────────────────────────────────────────
  describe('confirmOrder', () => {
    it('should transition PAID → CONFIRMED', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PAID'));
      prisma.order.update.mockResolvedValue(
        makeOrder('CONFIRMED', { confirmedAt: new Date() }),
      );

      const result = await service.confirmOrder('order-1', 'vendor-1');

      expect(result.status).toBe('CONFIRMED');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        }),
      );
    });

    it('should reject confirmation of PENDING orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PENDING'));

      await expect(service.confirmOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject double-confirmation of CONFIRMED orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('CONFIRMED'));

      await expect(service.confirmOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('fulfillOrder', () => {
    it('should transition CONFIRMED → FULFILLED', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('CONFIRMED'));
      prisma.order.update.mockResolvedValue(
        makeOrder('FULFILLED', { fulfilledAt: new Date() }),
      );

      const result = await service.fulfillOrder('order-1', 'vendor-1');

      expect(result.status).toBe('FULFILLED');
    });

    it('should reject fulfillment of PAID (not yet confirmed) orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PAID'));

      await expect(service.fulfillOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a PENDING order', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PENDING'));
      prisma.order.update.mockResolvedValue(
        makeOrder('CANCELLED', { cancelledAt: new Date() }),
      );

      const result = await service.cancelOrder('order-1', 'vendor-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a PAID order', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('PAID'));
      prisma.order.update.mockResolvedValue(
        makeOrder('CANCELLED', { cancelledAt: new Date() }),
      );

      const result = await service.cancelOrder('order-1', 'vendor-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a CONFIRMED order', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('CONFIRMED'));
      prisma.order.update.mockResolvedValue(
        makeOrder('CANCELLED', { cancelledAt: new Date() }),
      );

      const result = await service.cancelOrder('order-1', 'vendor-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancellation of FULFILLED orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('FULFILLED'));

      await expect(service.cancelOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancellation of already-CANCELLED orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('CANCELLED'));

      await expect(service.cancelOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancellation of EXPIRED orders', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder('EXPIRED'));

      await expect(service.cancelOrder('order-1', 'vendor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── expirePendingOrders (cron) ───────────────────────────────────────────────
  describe('expirePendingOrders', () => {
    it('should expire PENDING orders older than 30 minutes', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 3 });

      await service.expirePendingOrders();

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('should use a cutoff of 30 minutes in the past', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      const before = new Date(Date.now() - 30 * 60 * 1000);

      await service.expirePendingOrders();

      const cutoff: Date =
        prisma.order.updateMany.mock.calls[0][0].where.createdAt.lt;
      // Allow a small tolerance for test execution time
      expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(2000);
    });

    it('should not throw when no orders are expired', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.expirePendingOrders()).resolves.not.toThrow();
    });
  });
});
