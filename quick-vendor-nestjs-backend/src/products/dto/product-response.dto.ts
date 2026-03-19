import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from '@prisma/client';

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  price!: number;

  /** Modern array format — preferred. */
  @ApiProperty()
  image_urls!: string[];

  /** Legacy individual image fields — mobile app compat. */
  @ApiPropertyOptional()
  image_url!: string | null;

  @ApiPropertyOptional()
  image_url_2!: string | null;

  @ApiPropertyOptional()
  image_url_3!: string | null;

  @ApiPropertyOptional()
  image_url_4!: string | null;

  @ApiProperty()
  is_available!: boolean;

  @ApiProperty()
  click_count!: number;

  @ApiProperty()
  user_id!: string;

  /** Alias for user_id — mobile app uses owner_id. */
  @ApiProperty()
  owner_id!: string;

  @ApiProperty()
  created_at!: Date;

  static fromProduct(product: Product): ProductResponseDto {
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
      image_url: product.imageUrl1 ?? null,
      image_url_2: product.imageUrl2 ?? null,
      image_url_3: product.imageUrl3 ?? null,
      image_url_4: product.imageUrl4 ?? null,
      is_available: product.isAvailable,
      click_count: product.clickCount,
      user_id: product.userId,
      owner_id: product.userId, // alias
      created_at: product.createdAt,
    };
  }
}
