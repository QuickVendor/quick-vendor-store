import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { type Application } from 'express';
import { AppModule } from './app.module';
import { describeConfig, type AppEnv } from './config/env';

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:19006',
];

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const appEnv = configService.get<AppEnv>('appEnv') ?? 'local';
  const port = configService.get<number>('port') ?? 3000;
  const frontendUrls = configService.get<string[]>('frontendUrls') ?? [];
  const isLocal = appEnv === 'local';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.use(cookieParser());

  // Mobile app sends login as form-urlencoded
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.use(express.urlencoded({ extended: true }));

  // CORS — local allows localhost:* for emulators and Next dev servers,
  // staging/production trust only the FRONTEND_URL allowlist.
  const allowedOrigins = isLocal
    ? [...LOCAL_DEV_ORIGINS, ...frontendUrls]
    : frontendUrls;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-feedback-secret',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QuickVendor API')
    .setDescription('Backend API for QuickVendor application')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);

  // Boot summary — useful when triaging "what env am I actually running?"
  const summary = describeConfig({
    appEnv,
    storageDriver:
      configService.get<'local' | 's3'>('storage.driver') ?? 'local',
    s3Bucket: configService.get<string>('storage.s3.bucketName') ?? '',
    paystackMode: configService.get<'test' | 'live'>('paystack.mode') ?? 'test',
    redisConnected: Boolean(configService.get<string>('redis.url')),
    corsOrigins: allowedOrigins.length,
  });

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`🔧 ${summary}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/docs`);
}

void bootstrap();
