import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
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
import { AdminProductsService } from '../services/admin-products.service';
import { ProductQueryDto } from '../dto/product-query.dto';

@ApiTags('Admin - Products')
@Controller('api/admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Patch(':id/hide')
  @ApiOperation({ summary: 'Hide a product' })
  async hide(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.productsService.hideProduct(admin.id, id);
    return { message: 'Product hidden' };
  }

  @Patch(':id/unhide')
  @ApiOperation({ summary: 'Unhide a product' })
  async unhide(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.productsService.unhideProduct(admin.id, id);
    return { message: 'Product unhidden' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  async delete(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.productsService.deleteProduct(admin.id, id);
  }
}
