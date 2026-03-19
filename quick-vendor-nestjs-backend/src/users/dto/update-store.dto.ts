import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'My Awesome Store' })
  @IsOptional()
  @IsString()
  store_name?: string;

  @ApiPropertyOptional({ example: 'my-awesome-store' })
  @IsOptional()
  @IsString()
  store_slug?: string;

  @ApiPropertyOptional({ example: '+2348000000000' })
  @IsOptional()
  @IsString()
  whatsapp_number?: string;
}
