import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalVendors,
      activeVendors,
      suspendedVendors,
      totalOrders,
      ordersByStatus,
      totalRevenue,
      openReports,
      totalProducts,
      activeProducts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'VENDOR' } }),
      this.prisma.user.count({ where: { role: 'VENDOR', status: 'ACTIVE' } }),
      this.prisma.user.count({
        where: { role: 'VENDOR', status: 'SUSPENDED' },
      }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] } },
      }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isAvailable: true } }),
    ]);

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
    });

    const revenue = totalRevenue._sum.amount ?? 0;
    const commissionPercentage = settings?.commissionPercentage ?? 5;
    const platformCommission = Math.floor(
      (revenue * commissionPercentage) / 100,
    );

    return {
      totalVendors,
      activeVendors,
      suspendedVendors,
      totalOrders,
      ordersByStatus: ordersByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      totalRevenue: revenue,
      platformCommission,
      commissionPercentage,
      openReports,
      totalProducts,
      activeProducts,
    };
  }

  async getRevenueChart(period: '7d' | '30d' | '90d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
        paidAt: { gte: startDate },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    // Group by date
    const dailyRevenue = new Map<string, number>();
    for (const order of orders) {
      if (!order.paidAt) continue;
      const dateKey = order.paidAt.toISOString().split('T')[0];
      dailyRevenue.set(
        dateKey,
        (dailyRevenue.get(dateKey) ?? 0) + order.amount,
      );
    }

    return Array.from(dailyRevenue.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  async getTopVendors(limit = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topVendors = await this.prisma.order.groupBy({
      by: ['vendorId'],
      _sum: { amount: true },
      _count: true,
      where: {
        status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
        paidAt: { gte: thirtyDaysAgo },
      },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const vendorIds = topVendors.map((v) => v.vendorId);
    const vendors = await this.prisma.user.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, email: true, storeName: true, storeSlug: true },
    });

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    return topVendors.map((v) => ({
      vendor: vendorMap.get(v.vendorId),
      totalRevenue: v._sum.amount ?? 0,
      orderCount: v._count,
    }));
  }

  async getRecentOrders(limit = 10) {
    return this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: { id: true, email: true, storeName: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
