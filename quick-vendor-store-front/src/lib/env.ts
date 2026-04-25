/**
 * Storefront environment contract — keeps env handling consistent with the
 * backend (APP_ENV is the source of truth) and disambiguates the two API
 * URLs we need:
 *
 *   - INTERNAL_API_URL  → server-side fetch (SSR runs inside Docker network
 *                          → backend is reachable as `http://backend:3000`,
 *                          NOT localhost which is the storefront container).
 *   - NEXT_PUBLIC_API_URL → browser fetch (host port mapping or public URL).
 *
 * Falls back to NEXT_PUBLIC_API_URL when INTERNAL_API_URL isn't set, which
 * is what we want on Railway (no internal network) where both server and
 * browser hit the public ingress.
 */

export type AppEnv = 'local' | 'staging' | 'production';

export interface StorefrontEnv {
  appEnv: AppEnv;
  isLocal: boolean;
  isStaging: boolean;
  isProduction: boolean;

  /** URL for browser-side fetches. Always public. */
  publicApiUrl: string;
  /** URL for server-side (SSR) fetches. May be a Docker DNS or private hostname. */
  internalApiUrl: string;
  /** This app's own canonical URL (used for OG metadataBase, sitemap, robots). */
  appUrl: string;

  paystackPublicKey: string;
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
    appUrl: 'http://localhost:3001',
  },
  staging: {
    publicApi: 'https://staging.api.quickvendor.store',
    appUrl: 'https://staging.store.quickvendor.store',
  },
  production: {
    publicApi: 'https://api.quickvendor.store',
    appUrl: 'https://store.quickvendor.store',
  },
};

function build(): StorefrontEnv {
  const appEnv = resolveAppEnv();
  const defaults = DEFAULTS[appEnv];

  const publicApiUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim() || defaults.publicApi;
  const internalApiUrl =
    process.env.INTERNAL_API_URL?.trim() || publicApiUrl;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || defaults.appUrl;

  const paystackPublicKey =
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() || '';

  // Mode safety: in production, refuse Paystack TEST keys at build time.
  // (Server-side build error is loud; client-side fallback prevents a broken
  // checkout in case someone builds with the wrong env.)
  if (
    appEnv === 'production' &&
    paystackPublicKey &&
    !paystackPublicKey.startsWith('pk_live_')
  ) {
    const msg =
      '[env] APP_ENV=production but NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not a pk_live_ key.';
    if (typeof window === 'undefined') throw new Error(msg);
    console.error(msg);
  }
  if (
    (appEnv === 'local' || appEnv === 'staging') &&
    paystackPublicKey.startsWith('pk_live_')
  ) {
    const msg = `[env] APP_ENV=${appEnv} must NOT use pk_live_ Paystack key.`;
    if (typeof window === 'undefined') throw new Error(msg);
    console.error(msg);
  }

  return {
    appEnv,
    isLocal: appEnv === 'local',
    isStaging: appEnv === 'staging',
    isProduction: appEnv === 'production',
    publicApiUrl,
    internalApiUrl,
    appUrl,
    paystackPublicKey,
  };
}

export const env: StorefrontEnv = build();

/** Returns the right API URL for the current execution context. */
export function getApiUrl(): string {
  return typeof window === 'undefined' ? env.internalApiUrl : env.publicApiUrl;
}
