import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminReportsService } from '../services/admin-reports.service';
import { ReportQueryDto } from '../dto/report-query.dto';
import { UpdateReportDto } from '../dto/update-report.dto';

@ApiTags('Admin - Reports')
@Controller('api/admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminReportsController {
  constructor(private readonly reportsService: AdminReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reports' })
  async findAll(@Query() query: ReportQueryDto) {
    return this.reportsService.findAll({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('escalated')
  @ApiOperation({ summary: 'Get escalated vendors' })
  async getEscalated() {
    return this.reportsService.getEscalated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report details' })
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update report status/notes' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.reportsService.updateReport(admin.id, id, dto);
  }

  @Post(':id/suspend-vendor')
  @ApiOperation({ summary: 'Resolve report and suspend vendor' })
  async suspendVendor(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    await this.reportsService.suspendVendorFromReport(admin.id, id);
    return { message: 'Report resolved and vendor suspended' };
  }
}
