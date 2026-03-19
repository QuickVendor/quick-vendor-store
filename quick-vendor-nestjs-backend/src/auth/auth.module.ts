import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlocklistService } from './token-blocklist.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.secret') ?? 'fallback-secret';
        const minutes =
          configService.get<number>('jwt.expirationMinutes') ?? 30;
        return {
          secret,
          signOptions: { expiresIn: `${minutes}m` },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, TokenBlocklistService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, TokenBlocklistService],
})
export class AuthModule {}
