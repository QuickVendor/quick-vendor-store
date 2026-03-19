import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ReportCategory } from '@prisma/client';

export class CreateReportDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  vendorId: string;

  @ApiProperty({ enum: ReportCategory })
  @IsNotEmpty()
  @IsEnum(ReportCategory)
  category: ReportCategory;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  customerEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
