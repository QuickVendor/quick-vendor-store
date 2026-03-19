import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlocklistService } from './token-blocklist.service';
import type { User } from '@prisma/client';

/**
 * Extracts JWT from Authorization header first, then falls back to cookie.
 */
function extractJwtFromRequest(req: Request): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;

  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.access_token ?? null;
}

interface JwtPayload {
  sub: string; // user.id (UUID)
  email: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly userCache = new Map<
    string,
    { user: User; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenBlocklist: TokenBlocklistService,
  ) {
    const secret = configService.get<string>('jwt.secret') ?? 'fallback-secret';
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true, // pass Request to validate() so we can check the raw token
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    // Extract the raw token to check against blocklist
    const token = extractJwtFromRequest(req);
    if (token && (await this.tokenBlocklist.isBlocked(token))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check cache first to avoid DB hit on every request
    const cached = this.userCache.get(payload.sub);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.user;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      this.userCache.delete(payload.sub);
      throw new UnauthorizedException('Account is suspended or deactivated');
    }

    // Cache for 5 minutes
    this.userCache.set(payload.sub, {
      user,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return user;
  }
}
