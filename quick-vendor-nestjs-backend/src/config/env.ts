/**
 * Environment contract — single source of truth.
 *
 * APP_ENV drives every other environment-dependent decision so the
 * deployment context cannot drift across config knobs:
 *
 *   APP_ENV=local       → uploads/ folder, Paystack TEST keys, lax CORS
 *   APP_ENV=staging     → S3, Paystack TEST keys, strict CORS
 *   APP_ENV=production  → S3, Paystack LIVE keys, strict CORS
 *
 * Validation runs once at boot. Misconfiguration fails fast — the app
 * refuses to start rather than booting in a half-broken state and
 * surprising you in prod.
 */

export type AppEnv = 'local' | 'staging' | 'production';
export type StorageDriver = 'local' | 's3';
export type PaystackMode = 'test' | 'live';

export interface AppConfig {
  appEnv: AppEnv;
  isProduction: boolean;
  isStaging: boolean;
  isLocal: boolean;

  port: number;
  baseUrl: string;
  frontendUrls: string[];

  jwt: {
    secret: string;
    expirationMinutes: number;
  };

  storage: {
    driver: StorageDriver;
    s3: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucketName: string;
    };
  };

  paystack: {
    mode: PaystackMode;
    secretKey: string;
    publicKey: string;
    webhookSecret: string;
    platformFeePercentage: number;
  };

  redis: { url: string };

  sentry: { dsn: string; environment: string };

  slack: { webhookUrl: string; feedbackSecretKey: string };

  email: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };

  whatsapp: {
    abstractApiKey: string;
    validationEnabled: boolean;
  };
}

class EnvError extends Error {
  constructor(messages: string[]) {
    super(`Environment validation failed:\n  - ${messages.join('\n  - ')}`);
    this.name = 'EnvError';
  }
}

function resolveAppEnv(raw: string | undefined): AppEnv {
  const value = (raw ?? '').toLowerCase().trim();
  if (value === 'local' || value === 'staging' || value === 'production') {
    return value;
  }
  // Back-compat: infer from NODE_ENV if APP_ENV unset.
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  if (nodeEnv === 'production') return 'production';
  return 'local';
}

function int(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

function commaList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build and validate the AppConfig from process.env.
 *
 * Throws EnvError if validation fails. Caller (NestJS ConfigModule) feeds
 * the returned object into ConfigService so consumers keep working.
 */
export function loadConfig(): AppConfig {
  const appEnv = resolveAppEnv(process.env.APP_ENV);
  const isProduction = appEnv === 'production';
  const isStaging = appEnv === 'staging';
  const isLocal = appEnv === 'local';

  // Storage driver — derived from APP_ENV unless explicitly overridden.
  // Local always uses the uploads/ folder. Staging/prod always use S3.
  const explicitDriver = process.env.STORAGE_DRIVER as
    | StorageDriver
    | undefined;
  const driver: StorageDriver =
    explicitDriver === 'local' || explicitDriver === 's3'
      ? explicitDriver
      : isLocal
        ? 'local'
        : 's3';

  const s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? '',
    bucketName: process.env.S3_BUCKET_NAME ?? '',
  };

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY ?? '';
  const paystackPublic = process.env.PAYSTACK_PUBLIC_KEY ?? '';
  const paystackMode: PaystackMode = paystackSecret.startsWith('sk_live_')
    ? 'live'
    : 'test';

  const config: AppConfig = {
    appEnv,
    isProduction,
    isStaging,
    isLocal,

    port: int(process.env.PORT, 3000),
    baseUrl:
      process.env.BASE_URL ??
      (isProduction
        ? 'https://api.quickvendor.store'
        : isStaging
          ? 'https://staging.api.quickvendor.store'
          : 'http://localhost:3000'),
    frontendUrls: commaList(process.env.FRONTEND_URL),

    jwt: {
      secret: process.env.SECRET_KEY ?? '',
      expirationMinutes: int(process.env.JWT_EXPIRATION_MINUTES, 10080),
    },

    storage: { driver, s3 },

    paystack: {
      mode: paystackMode,
      secretKey: paystackSecret,
      publicKey: paystackPublic,
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? '',
      platformFeePercentage: int(process.env.PLATFORM_FEE_PERCENTAGE, 5),
    },

    redis: { url: process.env.REDIS_URL ?? '' },

    sentry: {
      dsn: process.env.SENTRY_DSN ?? '',
      environment: process.env.SENTRY_ENVIRONMENT ?? appEnv,
    },

    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
      feedbackSecretKey: process.env.FEEDBACK_SECRET_KEY ?? '',
    },

    email: {
      host: process.env.SMTP_HOST ?? '',
      port: int(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM ?? 'QuickVendor <noreply@quickvendor.store>',
    },

    whatsapp: {
      abstractApiKey: process.env.ABSTRACT_API_KEY ?? '',
      validationEnabled: bool(process.env.WHATSAPP_VALIDATION_ENABLED, false),
    },
  };

  validate(config);
  return config;
}

function validate(c: AppConfig): void {
  const errors: string[] = [];

  // ── JWT secret ──
  // Must be non-empty everywhere. In non-local must be non-default.
  if (!c.jwt.secret) {
    errors.push('SECRET_KEY is required.');
  } else if (
    !c.isLocal &&
    (c.jwt.secret === 'dev-secret-change-in-production' ||
      c.jwt.secret.length < 32)
  ) {
    errors.push(
      `SECRET_KEY must be at least 32 chars and not the default in ${c.appEnv}.`,
    );
  }

  // ── Paystack mode must match APP_ENV ──
  // Live keys in non-prod = real money charged in tests. Test keys in
  // prod = real customers can't pay. Both are catastrophic so refuse boot.
  if (c.paystack.secretKey || c.paystack.publicKey) {
    const sec = c.paystack.secretKey;
    const pub = c.paystack.publicKey;

    if (sec && !sec.startsWith('sk_test_') && !sec.startsWith('sk_live_')) {
      errors.push('PAYSTACK_SECRET_KEY must start with sk_test_ or sk_live_.');
    }
    if (pub && !pub.startsWith('pk_test_') && !pub.startsWith('pk_live_')) {
      errors.push('PAYSTACK_PUBLIC_KEY must start with pk_test_ or pk_live_.');
    }
    if (sec.startsWith('sk_live_') !== pub.startsWith('pk_live_')) {
      errors.push(
        'PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY must be the same mode (both test or both live).',
      );
    }

    if (c.isProduction && c.paystack.mode !== 'live') {
      errors.push(
        'APP_ENV=production requires Paystack LIVE keys (sk_live_/pk_live_).',
      );
    }
    if (!c.isProduction && c.paystack.mode === 'live') {
      errors.push(
        `APP_ENV=${c.appEnv} must NOT use Paystack LIVE keys — use sk_test_/pk_test_.`,
      );
    }

    // Webhook secret: required in non-local since webhooks only fire from Paystack
    if (!c.isLocal && !c.paystack.webhookSecret) {
      errors.push(
        'PAYSTACK_WEBHOOK_SECRET is required in staging/production for signature verification.',
      );
    }
  } else if (!c.isLocal) {
    errors.push(
      `Paystack keys are required in ${c.appEnv}. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY.`,
    );
  }

  // ── Storage driver ──
  if (c.storage.driver === 's3') {
    const s = c.storage.s3;
    if (!s.accessKeyId || !s.secretAccessKey || !s.region || !s.bucketName) {
      errors.push(
        'STORAGE_DRIVER=s3 requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME.',
      );
    }
  }
  if (!c.isLocal && c.storage.driver === 'local') {
    errors.push(
      `STORAGE_DRIVER=local in APP_ENV=${c.appEnv} — non-local environments must use S3 (Railway/VPS filesystems are ephemeral).`,
    );
  }

  // ── Frontend URLs ──
  if (!c.isLocal && c.frontendUrls.length === 0) {
    errors.push(
      'FRONTEND_URL is required in staging/production for CORS allowlist.',
    );
  }

  // ── Redis ──
  // Warned at runtime only; not fatal. Token blocklist falls back to in-mem.

  if (errors.length > 0) {
    throw new EnvError(errors);
  }
}

export interface ConfigSummary {
  appEnv: AppEnv;
  storageDriver: StorageDriver;
  s3Bucket: string;
  paystackMode: PaystackMode;
  redisConnected: boolean;
  corsOrigins: number;
}

/** Render the resolved env summary for boot logs. Excludes secrets. */
export function describeConfig(s: ConfigSummary): string {
  return [
    `APP_ENV=${s.appEnv}`,
    `storage=${s.storageDriver}${s.storageDriver === 's3' ? `(${s.s3Bucket})` : ''}`,
    `paystack=${s.paystackMode}`,
    `redis=${s.redisConnected ? 'connected' : 'in-memory-fallback'}`,
    `cors=${s.corsOrigins} origin(s)`,
  ].join(' | ');
}
