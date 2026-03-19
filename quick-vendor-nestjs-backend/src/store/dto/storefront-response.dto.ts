import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  image_urls!: string[];

  @ApiProperty()
  is_available!: boolean;

  @ApiProperty()
  click_count!: number;
}

export class StorefrontResponseDto {
  @ApiProperty()
  vendor_id!: string;

  @ApiProperty()
  store_name!: string | null;

  @ApiProperty()
  store_slug!: string | null;

  @ApiPropertyOptional()
  banner_url!: string | null;

  @ApiProperty()
  vendor_email!: string;

  @ApiPropertyOptional()
  whatsapp_number!: string;

  @ApiProperty({ type: [PublicProductDto] })
  products!: PublicProductDto[];
}
