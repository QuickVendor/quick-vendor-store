import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async getSettings() {
    return this.prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
    });
  }

  async updateSettings(
    adminId: string,
    data: {
      commissionPercentage?: number;
      orderExpirationMinutes?: number;
      escalationThreshold?: number;
      escalationWindowDays?: number;
    },
  ) {
    const updated = await this.prisma.platformSettings.update({
      where: { id: 'singleton' },
      data,
    });

    await this.auditService.log(
      adminId,
      'SETTINGS_UPDATED',
      'PlatformSettings',
      'singleton',
      data,
    );

    return updated;
  }
}
