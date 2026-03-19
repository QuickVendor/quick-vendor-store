import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    const isPasswordValid = await argon2.verify(user.hashedPassword, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return user;
  }

  generateToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
      );
      return this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
    } catch {
      return null;
    }
  }

  async refreshToken(token: string): Promise<string | null> {
    try {
      // Verify signature but allow expired tokens for refresh
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
        { ignoreExpiration: true },
      );
      if (!payload?.sub) return null;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) return null;

      return this.generateToken(user);
    } catch {
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
