import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ default: 'bearer' })
  token_type: string = 'bearer';
}
