import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { UserCacheService } from '../../auth/user-cache.service';
import { ReportCategory, ReportStatus } from '@prisma/client';

@Injectable()
export class AdminReportsService {
  private readonly logger = new Logger(AdminReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly userCache: UserCacheService,
  ) {}

  async findAll(query: {
    page: number;
    limit: number;
    status?: ReportStatus;
    category?: ReportCategory;
    vendorId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {};

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: query.startDate } : {}),
        ...(query.endDate ? { lte: query.endDate } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          vendor: { select: { id: true, email: true, storeName: true } },
          order: { select: { id: true, reference: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async getEscalated() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
    });

    const threshold = settings?.escalationThreshold ?? 3;
    const windowDays = settings?.escalationWindowDays ?? 30;
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    // Find vendors with reports above threshold in the window
    const escalatedVendors = await this.prisma.report.groupBy({
      by: ['vendorId'],
      _count: true,
      where: {
        createdAt: { gte: windowStart },
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
      having: { vendorId: { _count: { gte: threshold } } },
    });

    const vendorIds = escalatedVendors.map((v) => v.vendorId);
    const vendors = await this.prisma.user.findMany({
      where: { id: { in: vendorIds } },
      select: {
        id: true,
        email: true,
        storeName: true,
        status: true,
        _count: { select: { reportsAgainst: true } },
      },
    });

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    return escalatedVendors.map((e) => ({
      vendor: vendorMap.get(e.vendorId),
      recentReportCount: e._count,
    }));
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, email: true, storeName: true, status: true },
        },
        order: true,
      },
    });

    if (!report) throw new NotFoundException('Report not found');

    // Fetch related reports for same vendor
    const relatedReports = await this.prisma.report.findMany({
      where: { vendorId: report.vendorId, id: { not: id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { ...report, relatedReports };
  }

  async updateReport(
    adminId: string,
    reportId: string,
    data: {
      status?: ReportStatus;
      adminNotes?: string;
    },
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');

    const updateData: Record<string, unknown> = {};
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'DISMISSED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = adminId;
      }
    }
    if (data.adminNotes !== undefined) {
      updateData.adminNotes = data.adminNotes;
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: updateData,
    });

    await this.auditService.log(
      adminId,
      'REPORT_UPDATED',
      'Report',
      reportId,
      data,
    );

    return updated;
  }

  async suspendVendorFromReport(adminId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: adminId,
        },
      }),
      this.prisma.user.update({
        where: { id: report.vendorId },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspensionReason: `Suspended due to report: ${report.category}`,
        },
      }),
    ]);

    this.userCache.invalidate(report.vendorId);

    await this.auditService.log(
      adminId,
      'VENDOR_SUSPENDED_FROM_REPORT',
      'Report',
      reportId,
      { vendorId: report.vendorId, category: report.category },
    );
  }
}
