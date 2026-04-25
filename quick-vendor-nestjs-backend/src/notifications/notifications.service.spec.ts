/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

// ── Mock nodemailer at module level ────────────────────────────────────────────
// We capture sendMail/verify as stable references so tests can mutate them.
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'ok' });
const mockVerify = jest.fn().mockResolvedValue(true);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ORDER_DATA = {
  customerName: 'Alice',
  customerEmail: 'alice@test.com',
  productName: 'Test Cap',
  quantity: 2,
  amount: 5000, // kobo → ₦50.00
  reference: 'QV-ABCDEF',
  vendorStoreName: 'Cap Store',
};

const VENDOR_DATA = {
  vendorEmail: 'vendor@test.com',
  vendorStoreName: 'Cap Store',
  customerName: 'Alice',
  productName: 'Test Cap',
  quantity: 2,
  amount: 5000,
  reference: 'QV-ABCDEF',
};

// ── Builders ──────────────────────────────────────────────────────────────────

function buildConfigGet(smtpHost: string) {
  return jest.fn().mockImplementation((key: string) => {
    if (key === 'email.host') return smtpHost;
    if (key === 'email.port') return 587;
    if (key === 'email.from') return 'QuickVendor <noreply@quickvendor.store>';
    if (key === 'email.user') return '';
    if (key === 'email.pass') return '';
    return undefined;
  });
}

async function buildService(smtpHost: string): Promise<NotificationsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: ConfigService, useValue: { get: buildConfigGet(smtpHost) } },
    ],
  }).compile();

  const service = module.get<NotificationsService>(NotificationsService);
  await service.onModuleInit();
  return service;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  beforeEach(() => {
    mockSendMail.mockClear().mockResolvedValue({ messageId: 'ok' });
    mockVerify.mockClear().mockResolvedValue(true);
  });

  // ── SMTP not configured ───────────────────────────────────────────────────
  describe('when SMTP_HOST is not set', () => {
    it('sendOrderConfirmation should silently do nothing', async () => {
      const service = await buildService('');

      await service.sendOrderConfirmation(ORDER_DATA);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('sendVendorOrderNotification should silently do nothing', async () => {
      const service = await buildService('');

      await service.sendVendorOrderNotification(VENDOR_DATA);

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ── SMTP configured ───────────────────────────────────────────────────────
  describe('when SMTP_HOST is configured', () => {
    it('sendOrderConfirmation sends to customer email', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendOrderConfirmation(ORDER_DATA);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@test.com' }),
      );
    });

    it('sendOrderConfirmation subject contains the order reference', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendOrderConfirmation(ORDER_DATA);

      expect(mockSendMail.mock.calls[0][0].subject).toContain('QV-ABCDEF');
    });

    it('sendOrderConfirmation body displays amount in naira', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendOrderConfirmation(ORDER_DATA);

      const html: string = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('₦50');
    });

    it('sendOrderConfirmation HTML-escapes customer name to prevent XSS', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendOrderConfirmation({
        ...ORDER_DATA,
        customerName: '<script>alert("xss")</script>',
      });

      const html: string = mockSendMail.mock.calls[0][0].html;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('sendOrderConfirmation escapes & in product name', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendOrderConfirmation({
        ...ORDER_DATA,
        productName: 'Shirt & Hat',
      });

      const html: string = mockSendMail.mock.calls[0][0].html;
      expect(html).toContain('Shirt &amp; Hat');
    });

    it('sendVendorOrderNotification sends to vendor email', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendVendorOrderNotification(VENDOR_DATA);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'vendor@test.com' }),
      );
    });

    it('sendVendorOrderNotification subject contains the reference', async () => {
      const service = await buildService('smtp.mailgun.org');

      await service.sendVendorOrderNotification(VENDOR_DATA);

      expect(mockSendMail.mock.calls[0][0].subject).toContain('QV-ABCDEF');
    });

    it('does not rethrow when sendMail throws (fire-and-forget pattern)', async () => {
      const service = await buildService('smtp.mailgun.org');
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

      await expect(
        service.sendOrderConfirmation(ORDER_DATA),
      ).resolves.not.toThrow();
    });

    it('does not rethrow for vendor notification send failure', async () => {
      const service = await buildService('smtp.mailgun.org');
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.sendVendorOrderNotification(VENDOR_DATA),
      ).resolves.not.toThrow();
    });
  });
});
