import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { StorefrontResponseDto } from './dto/storefront-response.dto';

@ApiTags('store')
@Controller('api/store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get(':identifier')
  @ApiOperation({ summary: 'Get public storefront by slug or email' })
  @ApiParam({ name: 'identifier', description: 'Store slug or email prefix' })
  async getStorefront(
    @Param('identifier') identifier: string,
  ): Promise<StorefrontResponseDto> {
    return this.storeService.getStorefront(identifier);
  }
}
