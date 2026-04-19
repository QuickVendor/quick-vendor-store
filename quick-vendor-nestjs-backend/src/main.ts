import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const frontendUrl = configService.get<string>('frontendUrl') ?? '';

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // Parse URL-encoded bodies (mobile app sends login as form-urlencoded)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').urlencoded({ extended: true }));

  // CORS — FRONTEND_URL supports comma-separated values (storefront,admin)
  const isProd = process.env.NODE_ENV === 'production';
  const frontendOrigins = frontendUrl
    ? frontendUrl.split(',').map((u) => u.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: [
      ...(!isProd
        ? [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://localhost:8081',
            'http://localhost:19006',
            'http://localhost:3002',
          ]
        : []),
      ...frontendOrigins,
    ],
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

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('QuickVendor API')
    .setDescription('Backend API for QuickVendor application')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/docs`);
}

void bootstrap();
