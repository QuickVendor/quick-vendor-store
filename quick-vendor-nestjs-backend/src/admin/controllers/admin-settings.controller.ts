import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminSettingsService } from '../services/admin-settings.service';
import { UpdateSettingsDto } from '../dto/update-settings.dto';

@ApiTags('Admin - Settings')
@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get platform settings' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update platform settings (SUPER_ADMIN only)' })
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.settingsService.updateSettings(admin.id, dto);
  }
}
