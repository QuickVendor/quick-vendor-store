import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { PaymentsService } from '../../payments/payments.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(query: {
    page: number;
    limit: number;
    status?: OrderStatus;
    vendorId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {};

    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: query.startDate } : {}),
        ...(query.endDate ? { lte: query.endDate } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          vendor: { select: { id: true, email: true, storeName: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, email: true, storeName: true, storeSlug: true },
        },
        product: true,
      },
    });
  }

  async refund(adminId: string, orderId: string) {
    await this.paymentsService.initiateAdminRefund(orderId);

    await this.auditService.log(adminId, 'ORDER_REFUNDED', 'Order', orderId);
  }
}
