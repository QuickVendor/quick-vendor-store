import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenBlocklistService } from './token-blocklist.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenBlocklist: TokenBlocklistService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login and receive JWT token' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    const accessToken = this.authService.generateToken(user);

    this.setCookieOnResponse(res, accessToken);
    this.logger.log(`User logged in: ${user.email}`);

    return { access_token: accessToken, token_type: 'bearer' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate token and clear cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    // Block the current token so it's rejected on future requests
    const token = this.extractToken(req);
    if (token) {
      await this.tokenBlocklist.block(token);
    }

    // Clear the cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.useSecureCookie(),
      sameSite: this.useSecureCookie() ? 'none' : 'lax',
      path: '/',
    });

    this.logger.log('User logged out — token revoked');
    return { message: 'Successfully logged out' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an expired JWT token' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Reject if the old token was blocklisted
    if (await this.tokenBlocklist.isBlocked(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const newToken = await this.authService.refreshToken(token);
    if (!newToken) {
      throw new UnauthorizedException('Invalid token');
    }

    // Block the old token so it can't be reused
    await this.tokenBlocklist.block(token);

    this.setCookieOnResponse(res, newToken);

    return { access_token: newToken, token_type: 'bearer' };
  }

  @Get('check-session')
  @ApiOperation({ summary: 'Check if current session is valid' })
  async checkSession(
    @Req() req: Request,
  ): Promise<{ authenticated: boolean; user?: Record<string, unknown> }> {
    const token = this.extractToken(req);
    if (!token) {
      return { authenticated: false };
    }

    // Reject blocklisted tokens
    if (await this.tokenBlocklist.isBlocked(token)) {
      return { authenticated: false };
    }

    const user = await this.authService.verifyToken(token);
    if (!user) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        store_name: user.storeName,
        store_slug: user.storeSlug,
      },
    };
  }

  // ── Private helpers ──────────────────────────────────────

  private useSecureCookie(): boolean {
    const env =
      this.configService.get<string>('sentry.environment') ?? 'development';
    return env !== 'development';
  }

  private setCookieOnResponse(res: Response, token: string): void {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: this.useSecureCookie(),
      sameSite: this.useSecureCookie() ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.access_token ?? null;
  }
}
