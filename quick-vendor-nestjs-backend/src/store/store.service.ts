import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorefrontResponseDto,
  PublicProductDto,
} from './dto/storefront-response.dto';
import { Product } from '@prisma/client';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStorefront(identifier: string): Promise<StorefrontResponseDto> {
    // Try finding by slug first, then by email prefix
    let user = await this.prisma.user.findUnique({
      where: { storeSlug: identifier },
      include: { products: true },
    });

    if (!user) {
      // Try email-based lookup (identifier could be the part before @)
      user = await this.prisma.user.findFirst({
        where: {
          email: { startsWith: identifier.toLowerCase() },
        },
        include: { products: true },
      });
    }

    if (!user) {
      throw new NotFoundException('Store not found');
    }

    const availableProducts = user.products
      .filter((p) => p.isAvailable)
      .map((p) => this.toPublicProduct(p));

    return {
      vendor_id: user.id,
      store_name: user.storeName,
      store_slug: user.storeSlug,
      banner_url: user.bannerUrl,
      vendor_email: user.email,
      whatsapp_number: user.whatsappNumber,
      products: availableProducts,
    };
  }

  private toPublicProduct(product: Product): PublicProductDto {
    const imageUrls: string[] = [];
    if (product.imageUrl1) imageUrls.push(product.imageUrl1);
    if (product.imageUrl2) imageUrls.push(product.imageUrl2);
    if (product.imageUrl3) imageUrls.push(product.imageUrl3);
    if (product.imageUrl4) imageUrls.push(product.imageUrl4);

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      image_urls: imageUrls,
      is_available: product.isAvailable,
      click_count: product.clickCount,
    };
  }
}
