import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { StorageService } from '../storage/storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';

@ApiTags('products')
@Controller('api/products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 4))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  async create(
    @CurrentUser() user: User,
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.create(
      user.id,
      createProductDto,
      files ?? [],
    );
    return ProductResponseDto.fromProduct(product);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List own products' })
  async findAll(@CurrentUser() user: User): Promise<ProductResponseDto[]> {
    const products = await this.productsService.findAllByUser(user.id);
    return products.map(ProductResponseDto.fromProduct);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 4))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.update(
      id,
      user.id,
      updateProductDto,
      files,
    );
    return ProductResponseDto.fromProduct(product);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.productsService.remove(id, user.id);
  }

  @Post(':id/track-click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a product click (public)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async trackClick(@Param('id') id: string): Promise<{ click_count: number }> {
    return this.productsService.trackClick(id);
  }

  @Post(':id/images/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image to specific slot' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async uploadImage(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body('image_slot') imageSlot: string,
  ): Promise<{ url: string; key: string; slot: number }> {
    const slot = parseInt(imageSlot ?? '1', 10);
    return this.productsService.uploadImageToSlot(id, user.id, slot, file);
  }

  @Delete(':id/images/:slot')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete image from specific slot' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiParam({ name: 'slot', description: 'Image slot (1-4)' })
  async deleteImage(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.productsService.deleteImageFromSlot(
      id,
      user.id,
      parseInt(slot, 10),
    );
  }

  @Get('s3/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check storage health' })
  async getStorageStatus(): Promise<{
    configured: boolean;
    driver: string;
  }> {
    return {
      configured: this.storageService.isConfigured(),
      driver: this.storageService.getDriverName(),
    };
  }

  // ── S3 endpoint aliases (mobile app compatibility) ─────────

  @Post(':id/images/s3')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image to slot (S3 compat alias)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async uploadImageS3(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Query('slot') slotStr?: string,
  ): Promise<{ url: string; key: string; slot: number }> {
    const slot = parseInt(slotStr ?? '1', 10);
    return this.productsService.uploadImageToSlot(id, user.id, slot, file);
  }

  @Delete(':id/images/s3/:slot')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete image from slot (S3 compat alias)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiParam({ name: 'slot', description: 'Image slot (1-4)' })
  async deleteImageS3(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.productsService.deleteImageFromSlot(
      id,
      user.id,
      parseInt(slot, 10),
    );
  }
}
