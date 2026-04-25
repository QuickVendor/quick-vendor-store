import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('users')
@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto & { user: UserProfileDto }> {
    const user = await this.usersService.register(registerDto);
    const accessToken = this.authService.generateToken(user);

    const isProduction =
      this.configService.get<string>('sentry.environment') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(HttpStatus.CREATED);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      user: UserProfileDto.fromUser(user),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: User): UserProfileDto {
    return UserProfileDto.fromUser(user);
  }

  /** Alias: mobile app sends PUT /api/users/me for store updates. */
  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update store settings (alias for PUT me/store)' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateStoreDto: UpdateStoreDto,
  ): Promise<UserProfileDto> {
    const updated = await this.usersService.updateStore(
      user.id,
      updateStoreDto,
    );
    return UserProfileDto.fromUser(updated);
  }

  @Put('me/store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update store settings' })
  async updateStore(
    @CurrentUser() user: User,
    @Body() updateStoreDto: UpdateStoreDto,
  ): Promise<UserProfileDto> {
    const updated = await this.usersService.updateStore(
      user.id,
      updateStoreDto,
    );
    return UserProfileDto.fromUser(updated);
  }

  @Post('me/banner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('banner'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload store banner' })
  async uploadBanner(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    const updated = await this.usersService.uploadBanner(user.id, file);
    return UserProfileDto.fromUser(updated);
  }

  @Delete('me/banner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete store banner' })
  async deleteBanner(@CurrentUser() user: User): Promise<UserProfileDto> {
    const updated = await this.usersService.deleteBanner(user.id);
    return UserProfileDto.fromUser(updated);
  }
}
