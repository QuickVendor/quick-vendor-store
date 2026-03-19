import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReportDto) {
    // Verify vendor exists
    const vendor = await this.prisma.user.findUnique({
      where: { id: dto.vendorId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Verify order if provided
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
      });
      if (!order) throw new NotFoundException('Order not found');
    }

    const report = await this.prisma.report.create({
      data: {
        vendorId: dto.vendorId,
        category: dto.category,
        description: dto.description,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        orderId: dto.orderId,
      },
    });

    this.logger.log(
      `Report ${report.id} created against vendor ${dto.vendorId}`,
    );
    return report;
  }
}
