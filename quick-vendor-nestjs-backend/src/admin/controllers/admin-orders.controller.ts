import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOrdersService } from '../services/admin-orders.service';
import { OrderQueryDto } from '../dto/order-query.dto';

@ApiTags('Admin - Orders')
@Controller('api/admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminOrdersController {
  constructor(private readonly ordersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders' })
  async findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Initiate admin refund' })
  async refund(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.ordersService.refund(admin.id, id);
    return { message: 'Refund initiated successfully' };
  }
}
