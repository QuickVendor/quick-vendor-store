import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminVendorsService {
  private readonly logger = new Logger(AdminVendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    status?: UserStatus;
  }) {
    const where: Record<string, unknown> = { role: 'VENDOR' };

    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { storeName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          storeName: true,
          storeSlug: true,
          status: true,
          whatsappNumber: true,
          paymentSetupComplete: true,
          createdAt: true,
          suspendedAt: true,
          _count: {
            select: { products: true, orders: true, reportsAgainst: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        storeName: true,
        storeSlug: true,
        storeUrl: true,
        bannerUrl: true,
        status: true,
        role: true,
        whatsappNumber: true,
        whatsappVerified: true,
        paymentSetupComplete: true,
        bankCode: true,
        bankAccountNumber: true,
        bankAccountName: true,
        suspendedAt: true,
        suspensionReason: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { products: true, orders: true, reportsAgainst: true },
        },
      },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      throw new NotFoundException('Vendor not found');
    }

    // Get total revenue
    const revenue = await this.prisma.order.aggregate({
      _sum: { amount: true },
      where: {
        vendorId: id,
        status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
      },
    });

    return { ...vendor, totalRevenue: revenue._sum.amount ?? 0 };
  }

  async getVendorProducts(
    vendorId: string,
    query: { page: number; limit: number },
  ) {
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { userId: vendorId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where: { userId: vendorId } }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async getVendorOrders(
    vendorId: string,
    query: { page: number; limit: number },
  ) {
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { vendorId },
        include: {
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where: { vendorId } }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async suspendVendor(adminId: string, vendorId: string, reason: string) {
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      throw new NotFoundException('Vendor not found');
    }
    if (vendor.status === 'SUSPENDED') {
      throw new BadRequestException('Vendor is already suspended');
    }

    const updated = await this.prisma.user.update({
      where: { id: vendorId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: reason,
      },
    });

    await this.auditService.log(adminId, 'VENDOR_SUSPENDED', 'User', vendorId, {
      reason,
    });

    return updated;
  }

  async unsuspendVendor(adminId: string, vendorId: string) {
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      throw new NotFoundException('Vendor not found');
    }
    if (vendor.status !== 'SUSPENDED') {
      throw new BadRequestException('Vendor is not suspended');
    }

    const updated = await this.prisma.user.update({
      where: { id: vendorId },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await this.auditService.log(
      adminId,
      'VENDOR_UNSUSPENDED',
      'User',
      vendorId,
    );

    return updated;
  }

  async deleteVendor(adminId: string, vendorId: string) {
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      throw new NotFoundException('Vendor not found');
    }

    await this.prisma.user.update({
      where: { id: vendorId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    await this.auditService.log(adminId, 'VENDOR_DELETED', 'User', vendorId);
  }
}
