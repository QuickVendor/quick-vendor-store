import { loadConfig } from './env';

/**
 * NestJS ConfigModule loader. The shape is preserved for backward compat
 * so existing `configService.get('paystack.secretKey')` calls keep working,
 * but validation and APP_ENV-driven derivation happen in env.ts.
 */
export default () => {
  const c = loadConfig();
  return {
    appEnv: c.appEnv,
    isProduction: c.isProduction,
    isStaging: c.isStaging,
    isLocal: c.isLocal,

    port: c.port,
    baseUrl: c.baseUrl,
    frontendUrl: c.frontendUrls.join(','),
    frontendUrls: c.frontendUrls,

    jwt: c.jwt,
    storage: c.storage,
    paystack: c.paystack,
    redis: c.redis,
    sentry: c.sentry,
    slack: c.slack,
    email: c.email,
    whatsapp: c.whatsapp,
  };
};
