/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createHmac } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserCacheService } from '../auth/user-cache.service';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'vendor-1',
  email: 'vendor@example.com',
  storeName: 'Test Store',
  paystackSubaccountCode: null,
  bankCode: null,
  bankAccountNumber: null,
  bankAccountName: null,
  paymentSetupComplete: false,
};

const MOCK_ORDER_PAID = {
  id: 'order-1',
  reference: 'QV-ABC123',
  status: 'PAID',
  amount: 5000,
  paystackReference: 'ps_ref_001',
  vendorId: 'vendor-1',
  vendor: { id: 'vendor-1', email: 'vendor@example.com' },
};

const MOCK_ORDER_PENDING = {
  ...MOCK_ORDER_PAID,
  status: 'PENDING',
  paystackReference: null,
};
const MOCK_ORDER_CONFIRMED = { ...MOCK_ORDER_PAID, status: 'CONFIRMED' };
const MOCK_ORDER_FULFILLED = { ...MOCK_ORDER_PAID, status: 'FULFILLED' };

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildFetchMock(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    order: { findUnique: jest.Mock; update: jest.Mock };
  };
  let userCache: { invalidate: jest.Mock };
  let notifications: {
    sendOrderConfirmation: jest.Mock;
    sendVendorOrderNotification: jest.Mock;
  };
  let configGet: jest.Mock;

  function buildModule(secretKey = 'sk_test_abc') {
    configGet = jest.fn().mockImplementation((key: string) => {
      if (key === 'paystack.secretKey') return secretKey;
      if (key === 'paystack.platformFeePercentage') return 5;
      return undefined;
    });

    return Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: NotificationsService, useValue: notifications },
        { provide: UserCacheService, useValue: userCache },
      ],
    }).compile();
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      order: { findUnique: jest.fn(), update: jest.fn() },
    };
    userCache = { invalidate: jest.fn() };
    notifications = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendVendorOrderNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await buildModule();
    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── getBanks ─────────────────────────────────────────────────────────────
  describe('getBanks', () => {
    it('should fetch and filter active banks from Paystack', async () => {
      global.fetch = buildFetchMock(200, {
        data: [
          { name: 'Access Bank', code: '044', active: true },
          { name: 'Inactive Bank', code: '099', active: false },
        ],
      });

      const banks = await service.getBanks();

      expect(banks).toHaveLength(1);
      expect(banks[0].name).toBe('Access Bank');
    });

    it('should cache the bank list and avoid a second fetch', async () => {
      global.fetch = buildFetchMock(200, {
        data: [{ name: 'GTBank', code: '058', active: true }],
      });

      await service.getBanks();
      await service.getBanks();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when Paystack returns an error', async () => {
      global.fetch = buildFetchMock(500, { message: 'Internal Server Error' });

      await expect(service.getBanks()).rejects.toThrow(BadRequestException);
    });
  });

  // ── verifyAccount ─────────────────────────────────────────────────────────
  describe('verifyAccount', () => {
    it('should short-circuit with TEST ACCOUNT when using sk_test_ key', async () => {
      // sk_test_ key configured by default in buildModule()
      global.fetch = jest.fn();

      const result = await service.verifyAccount({
        accountNumber: '0123456789',
        bankCode: '058',
      });

      expect(result.accountName).toBe('TEST ACCOUNT');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should call Paystack /bank/resolve when using sk_live_ key', async () => {
      const module = await buildModule('sk_live_abc');
      service = module.get<PaymentsService>(PaymentsService);

      global.fetch = buildFetchMock(200, {
        data: {
          account_number: '0123456789',
          account_name: 'John Doe',
          bank_id: 1,
        },
      });

      const result = await service.verifyAccount({
        accountNumber: '0123456789',
        bankCode: '058',
      });

      expect(result.accountName).toBe('John Doe');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bank/resolve'),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when live resolve fails', async () => {
      const module = await buildModule('sk_live_abc');
      service = module.get<PaymentsService>(PaymentsService);

      global.fetch = buildFetchMock(422, {
        message: 'Could not resolve account',
      });

      await expect(
        service.verifyAccount({ accountNumber: '0000000000', bankCode: '058' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── setupPayment ──────────────────────────────────────────────────────────
  describe('setupPayment', () => {
    const dto = { bankCode: '058', accountNumber: '0123456789' };

    it('should create a new Paystack subaccount when none exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        paystackSubaccountCode: null,
      });
      prisma.user.update.mockResolvedValue(MOCK_USER);

      global.fetch = buildFetchMock(200, {
        data: { subaccount_code: 'ACCT_new123', id: 99 },
      });

      await service.setupPayment('vendor-1', dto);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/subaccount'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paystackSubaccountCode: 'ACCT_new123',
            paymentSetupComplete: true,
          }),
        }),
      );
      expect(userCache.invalidate).toHaveBeenCalledWith('vendor-1');
    });

    it('should update an existing subaccount via PUT when one exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        paystackSubaccountCode: 'ACCT_existing',
      });
      prisma.user.update.mockResolvedValue(MOCK_USER);

      global.fetch = buildFetchMock(200, {
        data: { subaccount_code: 'ACCT_existing', id: 1 },
      });

      await service.setupPayment('vendor-1', dto);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ACCT_existing'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      global.fetch = buildFetchMock(200, {}); // verifyAccount short-circuits for sk_test_

      await expect(service.setupPayment('missing-user', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when Paystack subaccount creation fails', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        paystackSubaccountCode: null,
      });

      global.fetch = buildFetchMock(400, { message: 'Invalid bank details' });

      await expect(service.setupPayment('vendor-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include the error message from Paystack in the exception', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        paystackSubaccountCode: null,
      });

      global.fetch = buildFetchMock(400, {
        message: 'Account number not valid',
      });

      await expect(service.setupPayment('vendor-1', dto)).rejects.toThrow(
        'Account number not valid',
      );
    });
  });

  // ── initiateRefund ────────────────────────────────────────────────────────
  describe('initiateRefund', () => {
    it('should refund a PAID order belonging to the vendor', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PAID);
      prisma.order.update.mockResolvedValue({
        ...MOCK_ORDER_PAID,
        status: 'REFUNDED',
      });
      global.fetch = buildFetchMock(200, { data: { id: 1 } });

      await service.initiateRefund('order-1', 'vendor-1');

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
    });

    it('should refund a CONFIRMED order belonging to the vendor', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_CONFIRMED);
      prisma.order.update.mockResolvedValue({
        ...MOCK_ORDER_CONFIRMED,
        status: 'REFUNDED',
      });
      global.fetch = buildFetchMock(200, { data: { id: 1 } });

      await expect(
        service.initiateRefund('order-1', 'vendor-1'),
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.initiateRefund('no-order', 'vendor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order belongs to another vendor', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...MOCK_ORDER_PAID,
        vendorId: 'other-vendor',
      });

      await expect(
        service.initiateRefund('order-1', 'vendor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order is PENDING (not paid)', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PENDING);

      await expect(
        service.initiateRefund('order-1', 'vendor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order is already FULFILLED', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_FULFILLED);

      await expect(
        service.initiateRefund('order-1', 'vendor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Paystack refund call fails', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PAID);
      global.fetch = buildFetchMock(500, { message: 'Paystack error' });

      await expect(
        service.initiateRefund('order-1', 'vendor-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── initiateAdminRefund ───────────────────────────────────────────────────
  describe('initiateAdminRefund', () => {
    it('should refund any PAID order regardless of vendor', async () => {
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PAID);
      prisma.order.update.mockResolvedValue({
        ...MOCK_ORDER_PAID,
        status: 'REFUNDED',
      });
      global.fetch = buildFetchMock(200, { data: { id: 1 } });

      await expect(
        service.initiateAdminRefund('order-1'),
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException for unknown order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.initiateAdminRefund('ghost-order')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────
  describe('handleWebhook', () => {
    const SECRET = 'sk_test_abc'; // matches default buildModule() key
    const PAYLOAD = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: 'QV-ABC123' },
      }),
    );

    function hmac(payload: Buffer, key: string): string {
      return createHmac('sha512', key).update(payload).digest('hex');
    }

    it('should mark order as PAID when signature is valid and order is PENDING', async () => {
      const sig = hmac(PAYLOAD, SECRET);
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PENDING);
      prisma.order.update.mockResolvedValue({
        ...MOCK_ORDER_PENDING,
        status: 'PAID',
        paidAt: new Date(),
        product: { name: 'Test Shirt' },
        vendor: { email: 'v@v.com', storeName: 'V Store' },
      });

      await service.handleWebhook(PAYLOAD, sig);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('should silently ignore webhooks with invalid signatures', async () => {
      await service.handleWebhook(PAYLOAD, 'invalid-sig');

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should be idempotent — skip already-PAID orders', async () => {
      const sig = hmac(PAYLOAD, SECRET);
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PAID);

      await service.handleWebhook(PAYLOAD, sig);

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should be idempotent — skip FULFILLED orders', async () => {
      const sig = hmac(PAYLOAD, SECRET);
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_FULFILLED);

      await service.handleWebhook(PAYLOAD, sig);

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should silently do nothing when order reference is not found', async () => {
      const sig = hmac(PAYLOAD, SECRET);
      prisma.order.findUnique.mockResolvedValue(null);

      await service.handleWebhook(PAYLOAD, sig);

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should silently do nothing for non-charge.success events', async () => {
      const unknownPayload = Buffer.from(
        JSON.stringify({
          event: 'transfer.success',
          data: { reference: 'QV-ABC123' },
        }),
      );
      const sig = hmac(unknownPayload, SECRET);

      await service.handleWebhook(unknownPayload, sig);

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('should silently do nothing when payload is invalid JSON', async () => {
      const badPayload = Buffer.from('not-json');
      const sig = hmac(badPayload, SECRET);

      await expect(
        service.handleWebhook(badPayload, sig),
      ).resolves.not.toThrow();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should fire email notifications after marking order PAID', async () => {
      const sig = hmac(PAYLOAD, SECRET);
      prisma.order.findUnique.mockResolvedValue(MOCK_ORDER_PENDING);
      prisma.order.update.mockResolvedValue({
        ...MOCK_ORDER_PENDING,
        status: 'PAID',
        paidAt: new Date(),
        customerName: 'Alice',
        customerEmail: 'alice@example.com',
        quantity: 2,
        product: { name: 'Cap' },
        vendor: { email: 'vendor@example.com', storeName: 'Cap Store' },
      });

      await service.handleWebhook(PAYLOAD, sig);

      // Notifications are fire-and-forget so we allow one tick before asserting
      await Promise.resolve();
      expect(notifications.sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ customerEmail: 'alice@example.com' }),
      );
      expect(notifications.sendVendorOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({ vendorEmail: 'vendor@example.com' }),
      );
    });
  });
});
