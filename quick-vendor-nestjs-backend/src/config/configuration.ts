export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

  jwt: {
    secret: process.env.SECRET_KEY ?? 'dev-secret-change-in-production',
    expirationMinutes: parseInt(
      process.env.JWT_EXPIRATION_MINUTES ?? '10080',
      10,
    ),
  },

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      region: process.env.AWS_REGION ?? '',
      bucketName: process.env.S3_BUCKET_NAME ?? '',
    },
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
    feedbackSecretKey: process.env.FEEDBACK_SECRET_KEY ?? '',
  },

  email: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from:
      process.env.SMTP_FROM ?? 'QuickVendor <noreply@quickvendor.com>',
  },

  redis: {
    url: process.env.REDIS_URL ?? '',
  },

  whatsapp: {
    abstractApiKey: process.env.ABSTRACT_API_KEY ?? '',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    platformFeePercentage: parseInt(
      process.env.PLATFORM_FEE_PERCENTAGE ?? '5',
      10,
    ),
  },
});
