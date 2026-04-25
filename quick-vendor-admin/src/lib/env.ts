/**
 * Admin environment contract — mirrors storefront/backend (APP_ENV is the
 * single source of truth) and exposes both INTERNAL_API_URL (server-side,
 * Docker DNS) and NEXT_PUBLIC_API_URL (browser).
 *
 * The admin app currently does most of its API work client-side (via a
 * token in localStorage), but we still expose getApiUrl() for any future
 * server-rendered routes so they don't have to think about it.
 */

export type AppEnv = 'local' | 'staging' | 'production';

export interface AdminEnv {
  appEnv: AppEnv;
  isLocal: boolean;
  isStaging: boolean;
  isProduction: boolean;

  publicApiUrl: string;
  internalApiUrl: string;
  appUrl: string;
}

function resolveAppEnv(): AppEnv {
  const raw = (
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.APP_ENV ??
    ''
  ).toLowerCase();
  if (raw === 'local' || raw === 'staging' || raw === 'production') return raw;
  return process.env.NODE_ENV === 'production' ? 'production' : 'local';
}

const DEFAULTS: Record<AppEnv, { publicApi: string; appUrl: string }> = {
  local: {
    publicApi: 'http://localhost:3000',
    appUrl: 'http://localhost:3002',
  },
  staging: {
    publicApi: 'https://staging.api.quickvendor.store',
    appUrl: 'https://staging.admin.quickvendor.store',
  },
  production: {
    publicApi: 'https://api.quickvendor.store',
    appUrl: 'https://admin.quickvendor.store',
  },
};

function build(): AdminEnv {
  const appEnv = resolveAppEnv();
  const defaults = DEFAULTS[appEnv];

  const publicApiUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim() || defaults.publicApi;
  const internalApiUrl =
    process.env.INTERNAL_API_URL?.trim() || publicApiUrl;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || defaults.appUrl;

  return {
    appEnv,
    isLocal: appEnv === 'local',
    isStaging: appEnv === 'staging',
    isProduction: appEnv === 'production',
    publicApiUrl,
    internalApiUrl,
    appUrl,
  };
}

export const env: AdminEnv = build();

/** Returns the right API URL for the current execution context. */
export function getApiUrl(): string {
  return typeof window === 'undefined' ? env.internalApiUrl : env.publicApiUrl;
}
