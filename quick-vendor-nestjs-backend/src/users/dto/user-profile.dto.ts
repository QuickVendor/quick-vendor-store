import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  whatsapp_number!: string;

  @ApiProperty({ nullable: true })
  store_name!: string | null;

  @ApiProperty({ nullable: true })
  store_slug!: string | null;

  @ApiProperty({ nullable: true })
  store_url!: string | null;

  @ApiProperty({ nullable: true })
  banner_url!: string | null;

  /** Alias for banner_url — mobile app uses this field name. */
  @ApiProperty({ nullable: true })
  store_banner_url!: string | null;

  /** Always true — NestJS backend has no deactivation logic yet. */
  @ApiProperty()
  is_active!: boolean;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  payment_setup_complete!: boolean;

  @ApiPropertyOptional({ nullable: true })
  bank_account_name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bank_code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bank_account_number!: string | null;

  static fromUser(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      whatsapp_number: user.whatsappNumber,
      store_name: user.storeName,
      store_slug: user.storeSlug,
      store_url: user.storeUrl,
      banner_url: user.bannerUrl,
      store_banner_url: user.bannerUrl, // alias
      is_active: true,
      created_at: user.createdAt,
      payment_setup_complete: user.paymentSetupComplete,
      bank_account_name: user.bankAccountName,
      bank_code: user.bankCode,
      bank_account_number: user.bankAccountNumber,
    };
  }
}
