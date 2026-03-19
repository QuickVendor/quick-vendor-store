import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupPaymentDto {
  @ApiProperty({ example: '044', description: 'Paystack bank code' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ example: '0123456789', description: 'Bank account number' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}
