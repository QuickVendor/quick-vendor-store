import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SuspendVendorDto {
  @ApiProperty({
    example: 'Fraudulent activity reported by multiple customers',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
