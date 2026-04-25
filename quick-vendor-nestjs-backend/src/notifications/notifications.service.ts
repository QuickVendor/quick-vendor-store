import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  productName: string;
  quantity: number;
  amount: number;
  reference: string;
  vendorStoreName: string;
}

interface VendorNotificationData {
  vendorEmail: string;
  vendorStoreName: string;
  customerName: string;
  productName: string;
  quantity: number;
  amount: number;
  reference: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('email.from') ??
      'QuickVendor <noreply@quickvendor.com>';
    this.enabled = !!this.configService.get<string>('email.host');
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'Email notifications disabled — SMTP_HOST not configured',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port') ?? 587,
      secure: this.configService.get<number>('email.port') === 465,
      auth: {
        user: this.configService.get<string>('email.user') ?? '',
        pass: this.configService.get<string>('email.pass') ?? '',
      },
    });

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
    } catch (error) {
      this.logger.warn('SMTP verification failed — emails may not send', error);
    }
  }

  /** Send order confirmation to customer. Fire-and-forget. */
  async sendOrderConfirmation(data: OrderEmailData): Promise<void> {
    if (!this.transporter) return;

    const amount = `₦${(data.amount / 100).toLocaleString('en-NG')}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: data.customerEmail,
        subject: `Order Confirmed — ${data.reference}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111;">Payment Confirmed!</h2>
            <p>Hi ${this.escapeHtml(data.customerName)},</p>
            <p>Your order has been confirmed. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Product</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${this.escapeHtml(data.productName)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Quantity</td>
                <td style="padding: 8px 0; text-align: right;">${data.quantity}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Amount</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #16a34a;">${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Reference</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${this.escapeHtml(data.reference)}</td>
              </tr>
            </table>
            <p style="color: #666;">
              Sold by <strong>${this.escapeHtml(data.vendorStoreName)}</strong>.
              The vendor will be in touch regarding fulfillment.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999;">Powered by QuickVendor</p>
          </div>
        `,
      });

      this.logger.log(`Order confirmation sent to ${data.customerEmail}`);
    } catch (error) {
      this.logger.warn(
        `Failed to send order confirmation to ${data.customerEmail}`,
        error,
      );
    }
  }

  /** Notify vendor of a new paid order. Fire-and-forget. */
  async sendVendorOrderNotification(
    data: VendorNotificationData,
  ): Promise<void> {
    if (!this.transporter) return;

    const amount = `₦${(data.amount / 100).toLocaleString('en-NG')}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: data.vendorEmail,
        subject: `New Order — ${data.reference}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111;">New Order Received!</h2>
            <p>Hi ${this.escapeHtml(data.vendorStoreName)},</p>
            <p>You have a new paid order to review:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Customer</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${this.escapeHtml(data.customerName)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Product</td>
                <td style="padding: 8px 0; text-align: right;">${this.escapeHtml(data.productName)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; color: #666;">Quantity</td>
                <td style="padding: 8px 0; text-align: right;">${data.quantity}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Amount</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #16a34a;">${amount}</td>
              </tr>
            </table>
            <p>Open your QuickVendor app to confirm and fulfill this order.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 12px; color: #999;">Powered by QuickVendor</p>
          </div>
        `,
      });

      this.logger.log(`Vendor notification sent to ${data.vendorEmail}`);
    } catch (error) {
      this.logger.warn(
        `Failed to send vendor notification to ${data.vendorEmail}`,
        error,
      );
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
