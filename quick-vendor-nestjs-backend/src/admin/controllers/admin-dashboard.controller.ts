import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('Admin - Dashboard')
@Controller('api/admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d'], required: false })
  async getRevenueChart(@Query('period') period: '7d' | '30d' | '90d' = '30d') {
    return this.dashboardService.getRevenueChart(period);
  }

  @Get('top-vendors')
  @ApiOperation({ summary: 'Get top vendors by revenue' })
  async getTopVendors() {
    return this.dashboardService.getTopVendors();
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'Get recent orders' })
  async getRecentOrders() {
    return this.dashboardService.getRecentOrders();
  }
}
