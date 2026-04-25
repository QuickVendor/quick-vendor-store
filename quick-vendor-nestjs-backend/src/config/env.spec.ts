/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Tests for the env-contract validator (src/config/env.ts).
 *
 * Each test group isolates process.env so mutations don't bleed across
 * tests. `loadConfig()` reads only from process.env, so resetting it is
 * the entire fixture requirement — no NestJS testing module needed.
 */

import { loadConfig } from './env';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Common keys touched across tests — reset them to avoid cross-test leakage. */
const ENV_KEYS = [
  'APP_ENV',
  'NODE_ENV',
  'PORT',
  'BASE_URL',
  'FRONTEND_URL',
  'SECRET_KEY',
  'JWT_EXPIRATION_MINUTES',
  'STORAGE_DRIVER',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET_NAME',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'PLATFORM_FEE_PERCENTAGE',
  'REDIS_URL',
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SLACK_WEBHOOK_URL',
  'FEEDBACK_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'ABSTRACT_API_KEY',
  'WHATSAPP_VALIDATION_ENABLED',
];

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

/** Minimum env that passes validation for the given APP_ENV. */
function minLocal(): Record<string, string> {
  return {
    APP_ENV: 'local',
    SECRET_KEY: 'dev-secret-change-in-production',
    PAYSTACK_SECRET_KEY: 'sk_test_abc',
    PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
    FRONTEND_URL: 'http://localhost:3001',
  };
}

function minStaging(): Record<string, string> {
  return {
    APP_ENV: 'staging',
    SECRET_KEY: 'a'.repeat(40),
    PAYSTACK_SECRET_KEY: 'sk_test_abc',
    PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
    PAYSTACK_WEBHOOK_SECRET: 'whsec_x',
    STORAGE_DRIVER: 's3',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'eu-west-1',
    S3_BUCKET_NAME: 'quickvendor-staging',
    FRONTEND_URL: 'https://staging.store.quickvendor.store',
  };
}

function minProduction(): Record<string, string> {
  return {
    APP_ENV: 'production',
    SECRET_KEY: 'a'.repeat(40),
    PAYSTACK_SECRET_KEY: 'sk_live_abc',
    PAYSTACK_PUBLIC_KEY: 'pk_live_abc',
    PAYSTACK_WEBHOOK_SECRET: 'whsec_x',
    STORAGE_DRIVER: 's3',
    AWS_ACCESS_KEY_ID: 'key',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_REGION: 'eu-west-1',
    S3_BUCKET_NAME: 'quickvendor-production',
    FRONTEND_URL: 'https://store.quickvendor.store',
  };
}

function set(vars: Record<string, string>): void {
  Object.assign(process.env, vars);
}

// ── Suite ──────────────────────────────────────────────────────────────────

beforeEach(clearEnv);
afterEach(clearEnv);

// ── Happy paths ─────────────────────────────────────────────────────────
describe('loadConfig — happy paths', () => {
  it('accepts a minimal local config', () => {
    set(minLocal());
    expect(() => loadConfig()).not.toThrow();
  });

  it('accepts a minimal staging config', () => {
    set(minStaging());
    expect(() => loadConfig()).not.toThrow();
  });

  it('accepts a minimal production config', () => {
    set(minProduction());
    expect(() => loadConfig()).not.toThrow();
  });

  it('derives storage driver from APP_ENV (local→local, staging→s3)', () => {
    set(minLocal());
    expect(loadConfig().storage.driver).toBe('local');

    clearEnv();
    set(minStaging());
    expect(loadConfig().storage.driver).toBe('s3');
  });

  it('derives paystack mode from secret key prefix', () => {
    set(minLocal());
    expect(loadConfig().paystack.mode).toBe('test');

    clearEnv();
    set(minProduction());
    expect(loadConfig().paystack.mode).toBe('live');
  });

  it('defaults sentry environment to APP_ENV when SENTRY_ENVIRONMENT unset', () => {
    set(minLocal());
    expect(loadConfig().sentry.environment).toBe('local');

    clearEnv();
    set({ ...minStaging() });
    expect(loadConfig().sentry.environment).toBe('staging');
  });

  it('respects explicit SENTRY_ENVIRONMENT override', () => {
    set({ ...minLocal(), SENTRY_ENVIRONMENT: 'custom-env' });
    expect(loadConfig().sentry.environment).toBe('custom-env');
  });

  it('splits FRONTEND_URL on commas into frontendUrls array', () => {
    set({ ...minLocal(), FRONTEND_URL: 'http://a.test,http://b.test' });
    expect(loadConfig().frontendUrls).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('derives baseUrl default per APP_ENV', () => {
    set(minLocal());
    expect(loadConfig().baseUrl).toBe('http://localhost:3000');

    clearEnv();
    set(minStaging());
    expect(loadConfig().baseUrl).toBe('https://staging.api.quickvendor.store');

    clearEnv();
    set(minProduction());
    expect(loadConfig().baseUrl).toBe('https://api.quickvendor.store');
  });

  it('respects explicit BASE_URL override', () => {
    set({ ...minLocal(), BASE_URL: 'http://custom.dev:9000' });
    expect(loadConfig().baseUrl).toBe('http://custom.dev:9000');
  });

  it('parses PORT as integer', () => {
    set({ ...minLocal(), PORT: '4000' });
    expect(loadConfig().port).toBe(4000);
  });

  it('falls back to port 3000 when PORT is unset', () => {
    set(minLocal());
    expect(loadConfig().port).toBe(3000);
  });

  it('parses JWT_EXPIRATION_MINUTES as integer', () => {
    set({ ...minLocal(), JWT_EXPIRATION_MINUTES: '1440' });
    expect(loadConfig().jwt.expirationMinutes).toBe(1440);
  });

  it('exposes all S3 credentials in storage.s3', () => {
    set(minProduction());
    const { s3 } = loadConfig().storage;
    expect(s3.accessKeyId).toBe('key');
    expect(s3.secretAccessKey).toBe('secret');
    expect(s3.region).toBe('eu-west-1');
    expect(s3.bucketName).toBe('quickvendor-production');
  });

  it('sets isLocal/isStaging/isProduction booleans correctly', () => {
    set(minLocal());
    const local = loadConfig();
    expect(local.isLocal).toBe(true);
    expect(local.isStaging).toBe(false);
    expect(local.isProduction).toBe(false);

    clearEnv();
    set(minStaging());
    const staging = loadConfig();
    expect(staging.isLocal).toBe(false);
    expect(staging.isStaging).toBe(true);
    expect(staging.isProduction).toBe(false);

    clearEnv();
    set(minProduction());
    const prod = loadConfig();
    expect(prod.isLocal).toBe(false);
    expect(prod.isStaging).toBe(false);
    expect(prod.isProduction).toBe(true);
  });

  it('falls back to "local" when APP_ENV is unset and NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    set(minLocal());
    delete process.env.APP_ENV;
    expect(loadConfig().appEnv).toBe('local');
  });

  it('infers production when APP_ENV is unset and NODE_ENV is production', () => {
    // Build a full production config without APP_ENV
    const env = minProduction();
    delete (env as any).APP_ENV;
    set(env);
    process.env.NODE_ENV = 'production';
    expect(loadConfig().appEnv).toBe('production');
    delete process.env.NODE_ENV;
  });

  it('allows STORAGE_DRIVER=local override on local APP_ENV', () => {
    set({ ...minLocal(), STORAGE_DRIVER: 'local' });
    expect(loadConfig().storage.driver).toBe('local');
  });

  it('exposes paystack platform fee percentage', () => {
    set({ ...minLocal(), PLATFORM_FEE_PERCENTAGE: '10' });
    expect(loadConfig().paystack.platformFeePercentage).toBe(10);
  });

  it('defaults platform fee to 5', () => {
    set(minLocal());
    expect(loadConfig().paystack.platformFeePercentage).toBe(5);
  });

  it('parses WHATSAPP_VALIDATION_ENABLED boolean', () => {
    set({ ...minLocal(), WHATSAPP_VALIDATION_ENABLED: 'true' });
    expect(loadConfig().whatsapp.validationEnabled).toBe(true);

    clearEnv();
    set({ ...minLocal(), WHATSAPP_VALIDATION_ENABLED: 'false' });
    expect(loadConfig().whatsapp.validationEnabled).toBe(false);
  });
});

// ── Paystack key validation ────────────────────────────────────────────
describe('loadConfig — Paystack key validation', () => {
  it('rejects sk_test_ in production', () => {
    set({
      ...minProduction(),
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
    });
    expect(() => loadConfig()).toThrow(/LIVE keys/);
  });

  it('rejects sk_live_ in local', () => {
    set({
      ...minLocal(),
      PAYSTACK_SECRET_KEY: 'sk_live_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_live_abc',
    });
    expect(() => loadConfig()).toThrow(/must NOT use Paystack LIVE/);
  });

  it('rejects sk_live_ in staging', () => {
    set({
      ...minStaging(),
      PAYSTACK_SECRET_KEY: 'sk_live_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_live_abc',
    });
    expect(() => loadConfig()).toThrow(/must NOT use Paystack LIVE/);
  });

  it('rejects mismatched key modes (sk_live_ + pk_test_)', () => {
    set({
      ...minProduction(),
      PAYSTACK_SECRET_KEY: 'sk_live_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
    });
    expect(() => loadConfig()).toThrow(/same mode/);
  });

  it('rejects mismatched key modes (sk_test_ + pk_live_)', () => {
    set({
      ...minLocal(),
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_live_abc',
    });
    expect(() => loadConfig()).toThrow(/same mode/);
  });

  it('rejects unrecognised secret key prefix', () => {
    set({
      ...minLocal(),
      PAYSTACK_SECRET_KEY: 'bad_key',
      PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
    });
    expect(() => loadConfig()).toThrow(/sk_test_ or sk_live_/);
  });

  it('rejects unrecognised public key prefix', () => {
    set({
      ...minLocal(),
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      PAYSTACK_PUBLIC_KEY: 'bad_key',
    });
    expect(() => loadConfig()).toThrow(/pk_test_ or pk_live_/);
  });

  it('requires PAYSTACK_WEBHOOK_SECRET in staging', () => {
    const env = minStaging();
    delete env.PAYSTACK_WEBHOOK_SECRET;
    set(env);
    expect(() => loadConfig()).toThrow(/PAYSTACK_WEBHOOK_SECRET/);
  });

  it('requires PAYSTACK_WEBHOOK_SECRET in production', () => {
    const env = minProduction();
    delete env.PAYSTACK_WEBHOOK_SECRET;
    set(env);
    expect(() => loadConfig()).toThrow(/PAYSTACK_WEBHOOK_SECRET/);
  });

  it('does not require PAYSTACK_WEBHOOK_SECRET in local', () => {
    set(minLocal()); // webhook secret absent
    expect(() => loadConfig()).not.toThrow();
  });

  it('requires Paystack keys in staging', () => {
    const env = minStaging();
    delete env.PAYSTACK_SECRET_KEY;
    delete env.PAYSTACK_PUBLIC_KEY;
    set(env);
    expect(() => loadConfig()).toThrow(/Paystack keys are required/);
  });
});

// ── JWT secret validation ───────────────────────────────────────────────
describe('loadConfig — JWT secret validation', () => {
  it('rejects empty SECRET_KEY', () => {
    set({ ...minLocal(), SECRET_KEY: '' });
    expect(() => loadConfig()).toThrow(/SECRET_KEY is required/);
  });

  it('rejects the default SECRET_KEY in staging', () => {
    set({
      ...minStaging(),
      SECRET_KEY: 'dev-secret-change-in-production',
    });
    expect(() => loadConfig()).toThrow(/SECRET_KEY must be at least 32/);
  });

  it('rejects the default SECRET_KEY in production', () => {
    set({
      ...minProduction(),
      SECRET_KEY: 'dev-secret-change-in-production',
    });
    expect(() => loadConfig()).toThrow(/SECRET_KEY must be at least 32/);
  });

  it('rejects a short SECRET_KEY in production', () => {
    set({ ...minProduction(), SECRET_KEY: 'short' });
    expect(() => loadConfig()).toThrow(/SECRET_KEY must be at least 32/);
  });

  it('allows the default SECRET_KEY in local', () => {
    set(minLocal()); // minLocal uses the default key
    expect(() => loadConfig()).not.toThrow();
  });
});

// ── Storage driver validation ────────────────────────────────────────────
describe('loadConfig — storage driver validation', () => {
  it('rejects STORAGE_DRIVER=local in staging', () => {
    set({ ...minStaging(), STORAGE_DRIVER: 'local' });
    expect(() => loadConfig()).toThrow(/non-local environments must use S3/);
  });

  it('rejects STORAGE_DRIVER=local in production', () => {
    set({ ...minProduction(), STORAGE_DRIVER: 'local' });
    expect(() => loadConfig()).toThrow(/non-local environments must use S3/);
  });

  it('requires all four S3 vars when STORAGE_DRIVER=s3', () => {
    set({ ...minStaging(), AWS_ACCESS_KEY_ID: '' });
    expect(() => loadConfig()).toThrow(/AWS_ACCESS_KEY_ID/);
  });

  it('requires S3_BUCKET_NAME when STORAGE_DRIVER=s3', () => {
    set({ ...minStaging(), S3_BUCKET_NAME: '' });
    expect(() => loadConfig()).toThrow(/S3_BUCKET_NAME/);
  });
});

// ── FRONTEND_URL validation ──────────────────────────────────────────────
describe('loadConfig — FRONTEND_URL validation', () => {
  it('requires FRONTEND_URL in production', () => {
    const env = minProduction();
    delete env.FRONTEND_URL;
    set(env);
    expect(() => loadConfig()).toThrow(/FRONTEND_URL is required/);
  });

  it('requires FRONTEND_URL in staging', () => {
    const env = minStaging();
    delete env.FRONTEND_URL;
    set(env);
    expect(() => loadConfig()).toThrow(/FRONTEND_URL is required/);
  });

  it('does not require FRONTEND_URL in local', () => {
    const env = minLocal();
    delete env.FRONTEND_URL;
    set(env);
    expect(() => loadConfig()).not.toThrow();
  });

  it('returns empty array for frontendUrls when FRONTEND_URL is absent', () => {
    const env = minLocal();
    delete env.FRONTEND_URL;
    set(env);
    expect(loadConfig().frontendUrls).toEqual([]);
  });

  it('trims whitespace around each URL in a comma list', () => {
    set({ ...minLocal(), FRONTEND_URL: ' http://a.test , http://b.test ' });
    expect(loadConfig().frontendUrls).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });
});

// ── Multiple simultaneous errors ────────────────────────────────────────
describe('loadConfig — multiple validation errors', () => {
  it('reports all errors in a single throw, not just the first', () => {
    set({
      APP_ENV: 'production',
      SECRET_KEY: 'short', // too short + not default check
      PAYSTACK_SECRET_KEY: 'sk_test_abc',
      PAYSTACK_PUBLIC_KEY: 'pk_test_abc',
      PAYSTACK_WEBHOOK_SECRET: 'w',
      AWS_ACCESS_KEY_ID: 'k',
      AWS_SECRET_ACCESS_KEY: 's',
      AWS_REGION: 'r',
      S3_BUCKET_NAME: 'b',
      FRONTEND_URL: 'https://x',
    });
    let message = '';
    try {
      loadConfig();
    } catch (e) {
      message = (e as Error).message;
    }
    // Should mention BOTH Paystack and JWT failures
    expect(message).toMatch(/LIVE keys/);
    expect(message).toMatch(/SECRET_KEY/);
  });
});
