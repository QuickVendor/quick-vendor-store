import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetupPaymentDto } from './dto/setup-payment.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';

export interface PaystackBank {
  name: string;
  code: string;
  active: boolean;
}

interface PaystackBankResolveData {
  account_number: string;
  account_name: string;
  bank_id: number;
}

interface PaystackSubaccountData {
  subaccount_code: string;
  id: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackBaseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly platformFeePercentage: number;
  private banksCache: PaystackBank[] | null = null;
  private banksCacheExpiry: number = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.secretKey = this.configService.get<string>('paystack.secretKey') ?? '';
    this.platformFeePercentage =
      this.configService.get<number>('paystack.platformFeePercentage') ?? 5;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getBanks(): Promise<PaystackBank[]> {
    const now = Date.now();
    if (this.banksCache && now < this.banksCacheExpiry) {
      return this.banksCache;
    }

    const response = await fetch(
      `${this.paystackBaseUrl}/bank?country=nigeria&per_page=100&use_cursor=false`,
      { headers: this.authHeaders },
    );

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch banks from Paystack');
    }

    const data = (await response.json()) as { data: PaystackBank[] };
    this.banksCache = data.data.filter((b) => b.active);
    this.banksCacheExpiry = now + 60 * 60 * 1000; // 1 hour cache
    return this.banksCache;
  }

  async verifyAccount(dto: VerifyAccountDto): Promise<{ accountName: string }> {
    const params = new URLSearchParams({
      account_number: dto.accountNumber,
      bank_code: dto.bankCode,
    });

    const response = await fetch(
      `${this.paystackBaseUrl}/bank/resolve?${params.toString()}`,
      { headers: this.authHeaders },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Could not verify account. Please check your bank details.',
      );
    }

    const data = (await response.json()) as { data: PaystackBankResolveData };
    return { accountName: data.data.account_name };
  }

  async setupPayment(userId: string, dto: SetupPaymentDto): Promise<void> {
    // 1. Verify account name
    const { accountName } = await this.verifyAccount({
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 2. Create or update Paystack subaccount
    let subaccountCode: string;

    if (user.paystackSubaccountCode) {
      // Update existing subaccount
      const response = await fetch(
        `${this.paystackBaseUrl}/subaccount/${user.paystackSubaccountCode}`,
        {
          method: 'PUT',
          headers: this.authHeaders,
          body: JSON.stringify({
            settlement_bank: dto.bankCode,
            account_number: dto.accountNumber,
            percentage_charge: this.platformFeePercentage / 100,
          }),
        },
      );
      if (!response.ok) {
        throw new BadRequestException(
          'Failed to update payment account with Paystack',
        );
      }
      subaccountCode = user.paystackSubaccountCode;
    } else {
      // Create new subaccount
      const response = await fetch(`${this.paystackBaseUrl}/subaccount`, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify({
          business_name: user.storeName ?? user.email,
          settlement_bank: dto.bankCode,
          account_number: dto.accountNumber,
          percentage_charge: this.platformFeePercentage / 100,
          primary_contact_email: user.email,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new BadRequestException(
          error.message ?? 'Failed to create payment account with Paystack',
        );
      }

      const data = (await response.json()) as { data: PaystackSubaccountData };
      subaccountCode = data.data.subaccount_code;
    }

    // 3. Save to database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        paystackSubaccountCode: subaccountCode,
        bankCode: dto.bankCode,
        bankAccountNumber: dto.accountNumber,
        bankAccountName: accountName,
        paymentSetupComplete: true,
      },
    });
  }

  async initiateRefund(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendor: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.vendorId !== userId) {
      throw new BadRequestException('You do not own this order');
    }

    await this.processRefund(order);
  }

  async initiateAdminRefund(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendor: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    await this.processRefund(order);
  }

  private async processRefund(order: {
    id: string;
    status: string;
    paystackReference: string | null;
    amount: number;
  }): Promise<void> {
    if (order.status !== 'PAID' && order.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Only PAID or CONFIRMED orders can be refunded',
      );
    }
    if (!order.paystackReference) {
      throw new BadRequestException(
        'No payment reference found for this order',
      );
    }

    const response = await fetch(`${this.paystackBaseUrl}/refund`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({
        transaction: order.paystackReference,
        amount: order.amount,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to initiate refund with Paystack');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    });
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      this.logger.warn('Invalid Paystack webhook signature');
      return;
    }

    let event: { event: string; data: { reference: string } };
    try {
      event = JSON.parse(payload.toString()) as typeof event;
    } catch {
      this.logger.error('Failed to parse webhook payload');
      return;
    }

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const order = await this.prisma.order.findUnique({
        where: { reference },
      });

      if (!order) {
        this.logger.warn(`Webhook: order not found for reference ${reference}`);
        return;
      }

      // Idempotent — skip if already processed
      if (order.status !== 'PENDING') {
        this.logger.log(
          `Webhook: order ${reference} already in status ${order.status}, skipping`,
        );
        return;
      }

      const updatedOrder = await this.prisma.order.update({
        where: { reference },
        data: {
          status: 'PAID',
          paystackReference: reference,
          paidAt: new Date(),
        },
        include: {
          product: { select: { name: true } },
          vendor: { select: { email: true, storeName: true } },
        },
      });

      this.logger.log(`Webhook: order ${reference} marked as PAID`);

      // Send email notifications (fire-and-forget)
      void this.notifications.sendOrderConfirmation({
        customerName: updatedOrder.customerName,
        customerEmail: updatedOrder.customerEmail,
        productName: updatedOrder.product.name,
        quantity: updatedOrder.quantity,
        amount: updatedOrder.amount,
        reference: updatedOrder.reference,
        vendorStoreName: updatedOrder.vendor.storeName ?? 'QuickVendor Store',
      });

      void this.notifications.sendVendorOrderNotification({
        vendorEmail: updatedOrder.vendor.email,
        vendorStoreName: updatedOrder.vendor.storeName ?? 'Your store',
        customerName: updatedOrder.customerName,
        productName: updatedOrder.product.name,
        quantity: updatedOrder.quantity,
        amount: updatedOrder.amount,
        reference: updatedOrder.reference,
      });
    }
  }
}
