import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const IMAGE_FIELDS = [
  'imageUrl1',
  'imageUrl2',
  'imageUrl3',
  'imageUrl4',
] as const;

type ImageField = (typeof IMAGE_FIELDS)[number];

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    userId: string,
    dto: CreateProductDto,
    files: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        isAvailable: dto.is_available ?? true,
        userId,
      },
    });

    // Upload images to available slots
    if (files.length > 0) {
      const imageData: Record<string, string> = {};

      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const result = await this.storageService.uploadProductImage(
          files[i].buffer,
          files[i].originalname,
          product.id,
          files[i].mimetype,
        );
        imageData[IMAGE_FIELDS[i]] = result.url;
      }

      return this.prisma.product.update({
        where: { id: product.id },
        data: imageData,
      });
    }

    return product;
  }

  async findAllByUser(userId: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(productId: string, userId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this product');
    }

    return product;
  }

  async update(
    productId: string,
    userId: string,
    dto: UpdateProductDto,
    files?: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.findOneByUser(productId, userId);

    // Update text fields
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.is_available !== undefined)
      updateData.isAvailable = dto.is_available;

    // Handle new images
    if (files && files.length > 0) {
      // Delete existing images
      for (const field of IMAGE_FIELDS) {
        const url = product[field];
        if (url) {
          await this.deleteImageByUrl(url);
        }
      }

      // Upload new images
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const result = await this.storageService.uploadProductImage(
          files[i].buffer,
          files[i].originalname,
          product.id,
          files[i].mimetype,
        );
        updateData[IMAGE_FIELDS[i]] = result.url;
      }

      // Clear unused slots
      for (let i = files.length; i < 4; i++) {
        updateData[IMAGE_FIELDS[i]] = null;
      }
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  async remove(productId: string, userId: string): Promise<void> {
    const product = await this.findOneByUser(productId, userId);

    // Delete all images
    for (const field of IMAGE_FIELDS) {
      const url = product[field];
      if (url) {
        await this.deleteImageByUrl(url);
      }
    }

    await this.prisma.product.delete({ where: { id: productId } });
    this.logger.log(`Product deleted: ${productId}`);
  }

  async trackClick(productId: string): Promise<{ click_count: number }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { clickCount: { increment: 1 } },
    });

    return { click_count: updated.clickCount };
  }

  async uploadImageToSlot(
    productId: string,
    userId: string,
    imageSlot: number,
    file: Express.Multer.File,
  ): Promise<{ url: string; key: string; slot: number }> {
    if (imageSlot < 1 || imageSlot > 4) {
      throw new BadRequestException('Image slot must be between 1 and 4');
    }

    const product = await this.findOneByUser(productId, userId);
    const fieldName = IMAGE_FIELDS[imageSlot - 1];

    // Delete existing image in this slot
    const existingUrl = product[fieldName];
    if (existingUrl) {
      await this.deleteImageByUrl(existingUrl);
    }

    const result = await this.storageService.uploadProductImage(
      file.buffer,
      file.originalname,
      product.id,
      file.mimetype,
    );

    await this.prisma.product.update({
      where: { id: productId },
      data: { [fieldName]: result.url },
    });

    return { url: result.url, key: result.key, slot: imageSlot };
  }

  async deleteImageFromSlot(
    productId: string,
    userId: string,
    imageSlot: number,
  ): Promise<void> {
    if (imageSlot < 1 || imageSlot > 4) {
      throw new BadRequestException('Image slot must be between 1 and 4');
    }

    const product = await this.findOneByUser(productId, userId);
    const fieldName = IMAGE_FIELDS[imageSlot - 1];

    const url = product[fieldName];
    if (url) {
      await this.deleteImageByUrl(url);
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { [fieldName]: null },
    });
  }

  private async deleteImageByUrl(url: string): Promise<void> {
    try {
      const s3Match = url.match(/amazonaws\.com\/(.+)$/);
      if (s3Match) {
        await this.storageService.deleteFile(s3Match[1]);
        return;
      }

      const localMatch = url.match(/\/uploads\/(.+)$/);
      if (localMatch) {
        await this.storageService.deleteFile(localMatch[1]);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete image: ${url}`, error);
    }
  }
}
