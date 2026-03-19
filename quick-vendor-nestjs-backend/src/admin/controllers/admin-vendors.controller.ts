import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminVendorsService } from '../services/admin-vendors.service';
import { VendorQueryDto } from '../dto/vendor-query.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { SuspendVendorDto } from '../dto/suspend-vendor.dto';

@ApiTags('Admin - Vendors')
@Controller('api/admin/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminVendorsController {
  constructor(private readonly vendorsService: AdminVendorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all vendors' })
  async findAll(@Query() query: VendorQueryDto) {
    return this.vendorsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor details' })
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get vendor products' })
  async getProducts(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.vendorsService.getVendorProducts(id, query);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get vendor orders' })
  async getOrders(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.vendorsService.getVendorOrders(id, query);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend a vendor' })
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendVendorDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.vendorsService.suspendVendor(admin.id, id, dto.reason);
  }

  @Patch(':id/unsuspend')
  @ApiOperation({ summary: 'Unsuspend a vendor' })
  async unsuspend(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.vendorsService.unsuspendVendor(admin.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a vendor' })
  async delete(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.vendorsService.deleteVendor(admin.id, id);
  }
}
