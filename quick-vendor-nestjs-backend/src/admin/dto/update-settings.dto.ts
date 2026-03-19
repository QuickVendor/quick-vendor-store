import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Platform commission percentage',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  commissionPercentage?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Minutes before unpaid orders expire',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  orderExpirationMinutes?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Number of reports to trigger escalation',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  escalationThreshold?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Days window for escalation count',
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  escalationWindowDays?: number;
}
