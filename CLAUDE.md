# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quick Vendor Store is a Nigerian-market vendor platform: vendors create stores, list products, and customers pay via Paystack and contact via WhatsApp. Four independent sub-projects — each managed separately with its own `yarn` and `.env`:

- **`quick-vendor-nestjs-backend`** — NestJS 11 + PostgreSQL 16 + Prisma v5 REST API
- **`quick-vendor-mobile-app`** — Expo 54 (React Native) vendor-facing app
- **`quick-vendor-store-front`** — Next.js 16 public storefront (SSR-first for SEO)
- **`quick-vendor-admin`** — Next.js 16 + shadcn/ui admin dashboard

All projects use Yarn and TypeScript strict mode. Run all commands from within each sub-project directory.

---

## Environment Contract (read this first)

`APP_ENV` is the single source of truth for every environment-dependent decision. Other knobs (`STORAGE_DRIVER`, Paystack key prefix, CORS strictness, Sentry env) are derived or validated against it. Misconfiguration fails boot loudly.

| `APP_ENV`    | `NODE_ENV`    | Storage   | Paystack keys      | CORS                                   |
|--------------|---------------|-----------|--------------------|----------------------------------------|
| `local`      | `development` | uploads/  | `sk_test_/pk_test_`| `localhost:*` auto-allowed             |
| `staging`    | `production`  | S3        | `sk_test_/pk_test_`| strict allowlist (`FRONTEND_URL`)      |
| `production` | `production`  | S3        | `sk_live_/pk_live_`| strict allowlist (`FRONTEND_URL`)      |

Backend validation lives in `quick-vendor-nestjs-backend/src/config/env.ts` (`loadConfig()`). Never bypass it. Cross-field rules enforced at boot:

- Paystack secret/public must be the same mode (both test or both live).
- `APP_ENV=production` rejects `sk_test_`. `APP_ENV=local|staging` rejects `sk_live_`.
- Non-local rejects `STORAGE_DRIVER=local` (Railway/VPS filesystems are ephemeral) and the default `SECRET_KEY`.
- Non-local requires `PAYSTACK_WEBHOOK_SECRET` and `FRONTEND_URL`.
- `STORAGE_DRIVER=s3` requires all four `AWS_*`/`S3_BUCKET_NAME` vars; `storage.service.ts` throws (does not silently fall back) in non-local if the S3 client fails to init.

The storefront and admin apps use `NEXT_PUBLIC_APP_ENV` and have a matching `src/lib/env.ts` with the same contract plus build-time Paystack key checks.

### Inter-service communication contract (Next.js apps)

`src/lib/env.ts` exposes two URLs and a helper that picks the right one:

- **`INTERNAL_API_URL`** — server-side (SSR) fetch URL. Inside `docker-compose.local.yml` this is `http://backend:3000` (Docker DNS); on Railway it falls back to the public URL since services don't share a network.
- **`NEXT_PUBLIC_API_URL`** — browser fetch URL, baked into the client bundle at build time (Next.js `NEXT_PUBLIC_*` semantics).
- **`getApiUrl()`** — returns `INTERNAL_API_URL` when `typeof window === 'undefined'`, else `NEXT_PUBLIC_API_URL`. Always use this in `src/lib/api.ts`; never read the env vars directly elsewhere.

Both `next.config.ts` files use `INTERNAL_API_URL` for the `/uploads/:path*` rewrite that proxies vendor images same-origin from the backend.

---

## Backend (`quick-vendor-nestjs-backend`)

**Stack:** NestJS 11, PostgreSQL 16, Prisma ORM v5, JWT + Passport, Swagger at `/docs`

### Commands

```bash
# Development
yarn dev                        # Watch mode (nest start --watch)
yarn quickvendor:dev            # Docker Compose (app + DB + Redis)
yarn quickvendor:dev:build      # Rebuild containers
yarn quickvendor:dev:down       # Stop containers
yarn quickvendor:fresh          # Full reset (down -v) + rebuild
yarn quickvendor:shell          # Shell into app container
yarn quickvendor:db             # psql shell into DB container

# Quality checks
yarn lint                       # ESLint check
yarn lint:fix                   # Auto-fix lint issues
yarn format                     # Prettier format
yarn type-check                 # TypeScript check
yarn pre-push                   # type-check + lint + format:check + test

# Testing
yarn test                       # Unit tests (rootDir: src, pattern: *.spec.ts)
yarn test:watch                 # Watch mode
yarn test:cov                   # Coverage
yarn test:e2e                   # E2E tests (jest-e2e.json config)

# Run a single test file
yarn test path/to/file.spec.ts
yarn test --testNamePattern="describe block name"

# Database
yarn db:migrate                 # Run migrations (dev)
yarn db:migrate:deploy          # Deploy migrations (prod/staging)
yarn db:migrate:create          # Create new migration file only (--create-only)
yarn db:generate                # Regenerate Prisma client after schema changes
yarn db:studio                  # Prisma Studio UI
yarn db:reset                   # Reset database
yarn db:seed                    # Run prisma/seed.ts (creates admin accounts)
```

### Architecture

Module-based NestJS: `AuthModule`, `UsersModule`, `ProductsModule`, `StoreModule`, `OrdersModule`, `PaymentsModule`, `AdminModule`, `ReportsModule`, `FeedbackModule`, `WhatsAppModule`, `NotificationsModule`, `StorageModule`, `PrismaModule`, `HealthModule`.

Each module follows Service → Controller → DTO. Global `ValidationPipe` enforces `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Rate limiting via `ThrottlerModule` (20 req/min globally, overridable per endpoint with `@Throttle()`). Background tasks via `ScheduleModule`.

**Common utilities (`src/common/`):**
- `decorators/` — `@IsNigerianPhone()` (custom class-validator), `@Roles()`, `@Public()`
- `guards/` — `ActiveUserGuard` (blocks suspended/closed/deleted), `RolesGuard`
- `middleware/` — request logging

**Typed configuration:** all env vars flow through `src/config/env.ts` → `configuration.ts` → NestJS `ConfigModule`. Consumers use `configService.get('paystack.secretKey')` — never `process.env` directly. Adding a new env var requires updating `AppConfig`, `loadConfig()`, validation rules, and the `.env*` templates.

### Data Models

**Key invariants in `prisma/schema.prisma`:**
- `User` — `role` (VENDOR/ADMIN/SUPER_ADMIN), `status` (ACTIVE/SUSPENDED/CLOSED/DELETED), `storeSlug` (unique), `paystackSubaccountCode`, bank details, `paymentSetupComplete`
- `Product` — `price` is **Int stored in kobo** (100 kobo = ₦1, never Float), up to 4 image URLs
- `Order` — `reference` (unique `QV-` prefixed), `amount` in kobo, status flow: `PENDING → PAID → CONFIRMED → FULFILLED` (or `EXPIRED/REFUNDED/CANCELLED`), `paystackReference`
- `Report` — customer dispute against vendor, `category` enum, `status` (OPEN/UNDER_REVIEW/RESOLVED/DISMISSED)
- `AuditLog` — admin action log with JSON `metadata`
- `PlatformSettings` — singleton row: `commissionPercentage` (5%), `orderExpirationMinutes` (30), `escalationThreshold` (3 reports/30 days triggers auto-flag)

### Auth

- Argon2 password hashing
- JWT extracted from Authorization header or cookie
- 5-minute in-memory user cache in `JwtStrategy` (avoids DB hit per request); suspended users bypass cache
- `TokenBlocklistService` uses Redis (ioredis) for logout invalidation; falls back to in-memory Map when `REDIS_URL` is not set
- Token payload: `{sub: userId, email, role}`

### Storage (dual-provider, driver auto-derives from APP_ENV)

- `local`: files in `uploads/`, served via `/uploads/...` (relative URLs — clients prepend their own base URL via the rewrite proxy)
- `s3`: AWS SDK v3, public-read ACL, returns absolute S3 URLs
- Key structure: `product-images/{productId}/{uuid}.ext`, `store-banners/{userId}/{uuid}.ext`

### Payments (Paystack)

- Vendor sets up bank details → backend creates Paystack subaccount (5% platform split auto-settled)
- `PaymentsService.verifyAccount()` short-circuits with `'TEST ACCOUNT'` when keys are `sk_test_` because Paystack's `/bank/resolve` only works in live mode
- Checkout: `POST /api/orders` creates PENDING order + calls Paystack Initialize Transaction → returns `authorization_url`
- Webhook at `POST /api/payments/webhook`: verifies `HMAC-SHA512(body, PAYSTACK_WEBHOOK_SECRET)` vs `x-paystack-signature`, must be idempotent, **excluded from ThrottlerGuard**
- PENDING orders auto-expire after 30 min via `@Cron` scheduled task
- Paystack test card: `4084 0840 8408 4081`

---

## Mobile App (`quick-vendor-mobile-app`)

**Stack:** Expo 54, React Native 0.81.5, Expo Router 4 (file-based routing in `app/`), Zustand v5, TanStack React Query v5, Axios

### Commands

```bash
yarn start      # Start Metro bundler
yarn android    # Android emulator
yarn ios        # iOS simulator
yarn lint       # Expo lint
```

### Architecture

```
src/
  core/
    api/        # Axios client + interceptors (auth, 401 auto-logout, error normalization)
    config/     # env.ts — auto-detects backend URL from Metro hostUri (no manual IP needed)
    services/   # upload.service
    utils/      # formatCurrency, validators
  features/     # auth, products, orders, payments, store — each with API + hooks + Zustand store
  theme/        # Colors, fonts, spacing
  types/        # API types and models

app/            # Expo Router routes (at project root, not inside src/)
```

**Auth store (`src/features/auth/authStore.ts`):**
- Token stored in `expo-secure-store`
- Cold start: `rehydrate()` restores token before any requests
- Logout calls server endpoint first, then clears secure store and Zustand state

**API client non-obvious patterns:**
- Auth interceptor uses lazy import of authStore to avoid circular dependency
- 401 auto-logout has `isLoggingOut` guard to prevent cascade on concurrent failing requests
- All errors normalized to `AppError` type via `normalizeError()`
- 15-second timeout (3G-friendly)

---

## Storefront (`quick-vendor-store-front`) and Admin (`quick-vendor-admin`)

**Storefront stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4. Dev port `3001`.
**Admin stack:** Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui + TanStack React Query. Dev port `3002`.

```bash
yarn dev    # Dev server
yarn build  # Production build (standalone output for Docker)
yarn lint   # ESLint
```

### Storefront route structure

```
src/app/
  page.tsx                                        # Landing page
  [slug]/page.tsx                                 # SSR — store page with product grid
  [slug]/[productId]/page.tsx                     # SSR — product detail
  [slug]/[productId]/checkout/page.tsx            # CSR — checkout form
  [slug]/[productId]/checkout/confirm/page.tsx    # Payment confirmation
  report/[slug]/page.tsx                          # Report vendor (public)
  robots.ts / sitemap.ts                          # SEO — read env.appUrl
```

Store and product pages are React Server Components for SEO — `generateMetadata` provides OpenGraph tags (critical for WhatsApp link previews in Nigeria). Checkout is CSR. Images use `next/image` (quality:60, AVIF/WebP) for 3G optimization. Image optimisation is auto-disabled when `APP_ENV=local` because the backend serves uploads over a private hostname (Next.js 16 rejects optimisation from non-public IPs).

### Admin

Admin accounts are created via `yarn db:seed` in the backend — never through public registration. Uses the same backend JWT with `RolesGuard` checking `role === ADMIN || SUPER_ADMIN`.

---

## Infrastructure

| Unit | Platform | URL |
|------|----------|-----|
| Backend + PostgreSQL + Redis | Railway | `api.quickvendor.store` |
| Storefront | Vercel | `store.quickvendor.store` |
| Admin | Vercel | `admin.quickvendor.store` |

Railway auto-deploys on push to `main`; `prisma migrate deploy` runs at container startup.

**Local docker-compose:** `docker-compose.local.yml` at the repo root brings up all four containers (backend, storefront, admin, db, redis) on a shared network for end-to-end integration testing. Each Next service receives `INTERNAL_API_URL=http://backend:3000` (server) and `NEXT_PUBLIC_API_URL=http://localhost:3000` (browser) at build time. Not used for Railway/VPS deployment — those use per-service Dockerfiles + `railway.json` directly.

**Railway env vars to set manually** (Postgres and Redis plugins inject their URLs but you must reference them):
```
APP_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
FRONTEND_URL=https://store.quickvendor.store,https://admin.quickvendor.store
```

See `docs/deploy.md` for the full deployment checklist.

---

## Cross-Cutting Conventions

- **Prices always in kobo** (Int). Never use Float for money. Display: `amount / 100` formatted as `₦`.
- **WhatsApp deep links:** `https://wa.me/{e164number}?text=Hi, I'm interested in {productName}`
- **Nigerian phone numbers:** validated with `@IsNigerianPhone()` custom class-validator decorator, normalized to E.164 format
- **Public endpoints** (no auth, but rate-limited): `POST /api/orders`, `GET /api/orders/:reference/verify`, `POST /api/reports`
- **Prettier:** single quotes, trailing commas (all projects)
