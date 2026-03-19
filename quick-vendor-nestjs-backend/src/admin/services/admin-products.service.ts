import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    vendorId?: string;
    isAvailable?: boolean;
  }) {
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.vendorId) where.userId = query.vendorId;
    if (query.isAvailable !== undefined) where.isAvailable = query.isAvailable;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, storeName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async hideProduct(adminId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id: productId },
      data: { isAvailable: false },
    });

    await this.auditService.log(
      adminId,
      'PRODUCT_HIDDEN',
      'Product',
      productId,
    );
  }

  async unhideProduct(adminId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id: productId },
      data: { isAvailable: true },
    });

    await this.auditService.log(
      adminId,
      'PRODUCT_UNHIDDEN',
      'Product',
      productId,
    );
  }

  async deleteProduct(adminId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.delete({ where: { id: productId } });

    await this.auditService.log(
      adminId,
      'PRODUCT_DELETED',
      'Product',
      productId,
      {
        name: product.name,
        vendorId: product.userId,
      },
    );
  }
}
