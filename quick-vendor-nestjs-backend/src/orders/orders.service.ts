import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { v4 as uuidv4 } from 'uuid';

interface PaystackInitResponse {
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly paystackBaseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.secretKey = this.configService.get<string>('paystack.secretKey') ?? '';
    this.frontendUrl =
      this.configService.get<string>('frontendUrl') ?? 'http://localhost:3001';
  }

  async createOrder(
    dto: CreateOrderDto,
  ): Promise<{ reference: string; authorizationUrl: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { owner: true },
    });

    if (!product) throw new NotFoundException('Product not found');
    if (!product.isAvailable)
      throw new BadRequestException('Product is not available');
    if (!product.owner.paymentSetupComplete) {
      throw new BadRequestException('Vendor has not set up payments yet');
    }

    const amount = product.price * dto.quantity;
    const reference = `QV-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    // Build callback URL pointing to confirmation page
    const callbackUrl = `${this.frontendUrl}/${product.owner.storeSlug ?? product.owner.id}/${product.id}/checkout/confirm?ref=${reference}`;

    // Initialize Paystack transaction
    const paystackResponse = await fetch(
      `${this.paystackBaseUrl}/transaction/initialize`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: dto.customerEmail,
          amount,
          reference,
          subaccount: product.owner.paystackSubaccountCode,
          callback_url: callbackUrl,
          metadata: {
            product_id: product.id,
            customer_name: dto.customerName,
            customer_phone: dto.customerPhone ?? '',
          },
        }),
      },
    );

    if (!paystackResponse.ok) {
      throw new BadRequestException(
        'Failed to initialize payment with Paystack',
      );
    }

    const paystackData =
      (await paystackResponse.json()) as PaystackInitResponse;

    // Create order in PENDING state
    await this.prisma.order.create({
      data: {
        reference,
        vendorId: product.owner.id,
        productId: product.id,
        quantity: dto.quantity,
        amount,
        customerEmail: dto.customerEmail,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
      },
    });

    return {
      reference,
      authorizationUrl: paystackData.data.authorization_url,
    };
  }

  async verifyOrder(
    reference: string,
  ): Promise<{ status: string; order: OrderResponseDto | null }> {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      status: order.status,
      order: OrderResponseDto.from(order),
    };
  }

  async getVendorOrders(
    vendorId: string,
    page = 1,
    limit = 20,
  ): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { vendorId },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return orders.map(OrderResponseDto.from);
  }

  async getVendorOrder(
    orderId: string,
    vendorId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.vendorId !== vendorId)
      throw new ForbiddenException('Access denied');

    return OrderResponseDto.from(order);
  }

  async confirmOrder(
    orderId: string,
    vendorId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.getVendorOrder(orderId, vendorId);
    if (order.status !== 'PAID') {
      throw new BadRequestException('Only PAID orders can be confirmed');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
    });

    return OrderResponseDto.from(updated);
  }

  async fulfillOrder(
    orderId: string,
    vendorId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.getVendorOrder(orderId, vendorId);
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Only CONFIRMED orders can be fulfilled');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
    });

    return OrderResponseDto.from(updated);
  }

  async cancelOrder(
    orderId: string,
    vendorId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.getVendorOrder(orderId, vendorId);
    if (!['PENDING', 'PAID', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('This order cannot be cancelled');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl1: true },
        },
      },
    });

    return OrderResponseDto.from(updated);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePendingOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    const result = await this.prisma.order.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Auto-expired ${result.count} pending order(s)`);
    }
  }
}
