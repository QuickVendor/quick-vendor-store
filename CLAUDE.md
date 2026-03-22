# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quick Vendor Store is a Nigerian-market vendor platform: vendors create stores, list products, and customers pay via Paystack and contact via WhatsApp. Four independent sub-projects — each managed separately with its own `yarn` and `.env`:

- **`quick-vendor-nestjs-backend`** — NestJS 11 + PostgreSQL 16 + Prisma v5 API
- **`quick-vendor-mobile-app`** — Expo 54 (React Native) vendor-facing app
- **`quick-vendor-store-front`** — Next.js 16 public storefront (SSR-first for SEO)
- **`quick-vendor-admin`** — Next.js 16 + shadcn/ui admin dashboard

All projects use Yarn and TypeScript strict mode.

---

## Backend (`quick-vendor-nestjs-backend`)

**Stack:** NestJS 11, PostgreSQL 16, Prisma ORM v5, JWT + Passport, Swagger at `/docs`

### Commands

```bash
# Development
yarn dev                        # Watch mode
yarn quickvendor:dev            # Docker Compose (app + DB)
yarn quickvendor:dev:build      # Rebuild containers
yarn quickvendor:dev:down       # Stop containers
yarn quickvendor:fresh          # Full reset + rebuild

# Quality checks
yarn lint                       # ESLint check
yarn lint:fix                   # Auto-fix lint issues
yarn format                     # Prettier format
yarn type-check                 # TypeScript check
yarn pre-push                   # All quality checks

# Testing
yarn test                       # Unit tests
yarn test:watch                 # Watch mode
yarn test:cov                   # Coverage
yarn test:e2e                   # E2E tests

# Database
yarn db:migrate                 # Run migrations
yarn db:migrate:create          # Create new migration
yarn db:generate                # Regenerate Prisma client
yarn db:studio                  # Prisma Studio UI
yarn db:reset                   # Reset database
```

### Architecture

Module-based NestJS: `AuthModule`, `UsersModule`, `ProductsModule`, `StoreModule`, `OrdersModule`, `PaymentsModule`, `AdminModule`, `ReportsModule`, `FeedbackModule`, `WhatsAppModule`, `NotificationsModule`, `StorageModule`, `PrismaModule`, `HealthModule`.

Each module follows Service → Controller → DTO. Global ValidationPipe enforces `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Rate limiting via `ThrottlerModule` (20 req/min globally, overridable per endpoint with `@Throttle()`). Background tasks via `ScheduleModule`.

**Data models (prisma/schema.prisma):**
- `User` — `role` (VENDOR/ADMIN/SUPER_ADMIN), `status` (ACTIVE/SUSPENDED/CLOSED/DELETED), `storeSlug` (unique), `storeName`, `bannerUrl`, `whatsappNumber`, `whatsappVerified`, `paystackSubaccountCode`, bank details, `paymentSetupComplete`
- `Product` — `price` is **Int stored in kobo** (100 kobo = 1 Naira, never Float), up to 4 image URLs, `isAvailable`, `clickCount`
- `Order` — `reference` (unique), `amount` in kobo, `status` (PENDING → PAID → CONFIRMED → FULFILLED, or EXPIRED/REFUNDED/CANCELLED), `paystackReference`
- `Report` — customer dispute, `category` enum, `status` (OPEN/UNDER_REVIEW/RESOLVED/DISMISSED), `adminNotes`
- `AuditLog` — admin action log, `metadata` is untyped JSON
- `PlatformSettings` — singleton row: `commissionPercentage` (5%), `orderExpirationMinutes` (30), `escalationThreshold` (3 reports/30 days triggers auto-flag)

**Auth:**
- Argon2 password hashing
- JWT extracted from Authorization header, falls back to cookie
- 5-minute in-memory user cache in `JwtStrategy` (avoids DB hit per request); suspended users bypass cache
- `TokenBlocklistService` uses Redis (ioredis) for logout invalidation
- Token payload: `{sub: userId, email, role}`; token validates `user.status` — suspended users get 401 even with valid token

**Storage (dual-provider):**
- `STORAGE_DRIVER=local` (dev): files in `uploads/`, served via `/uploads/...`, returns relative paths
- `STORAGE_DRIVER=s3` (prod): AWS SDK v3, `public-read` ACL, returns absolute S3 URLs
- Key structure: `product-images/{productId}/{uuid}.ext`, `store-banners/{userId}/{uuid}.ext`

**Payments (Paystack):**
- Vendor sets up bank details → backend creates Paystack subaccount (5% platform split auto-settled)
- Checkout: `POST /api/orders` creates PENDING order + calls Paystack Initialize Transaction → returns `authorization_url`
- Webhook at `POST /api/payments/webhook`: verifies `HMAC-SHA512(body, PAYSTACK_WEBHOOK_SECRET)` vs `x-paystack-signature`, must be idempotent, excluded from ThrottlerGuard
- Paystack test card: `4084 0840 8408 4081`

**Key env vars** (beyond `.env.example` basics):
```
PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, PAYSTACK_WEBHOOK_SECRET
PLATFORM_FEE_PERCENTAGE=5
REDIS_URL
ABSTRACT_API_KEY          # WhatsApp phone validation
WHATSAPP_VALIDATION_ENABLED=true
SLACK_WEBHOOK_URL         # Feedback + report notifications
```

---

## Mobile App (`quick-vendor-mobile-app`)

**Stack:** Expo 54, React Native 0.81.5, Expo Router 6 (file-based), Zustand v5, TanStack React Query v5, Axios

### Commands

```bash
yarn start      # Start Metro bundler
yarn android    # Android emulator
yarn ios        # iOS simulator
yarn web        # Web preview
yarn lint       # Lint
```

### Architecture

Feature-based under `src/`:

```
core/
  api/          # Axios client + interceptors (auth, logging, error normalization)
  config/       # env.ts — Expo-aware API URL detection
  components/   # ErrorBoundary, Toast
  hooks/        # useToast
  services/     # upload.service
  utils/        # formatCurrency, validators
features/
  auth/         # Zustand store (authStore.ts) + API + hooks
  products/     # API + useProducts hook
  orders/       # API + useOrders hook
  payments/     # Paystack integration
  store/        # useStore, useStoreSummary hooks
theme/          # Colors, fonts, spacing
types/          # API types and models
app/            # Expo Router routes (see below)
```

**Expo Router route structure:**
```
app/
  (auth)/       # welcome, login, register
  (main)/
    dashboard, profile, settings, payments
    products/   # index, add, [id] (edit)
    orders/     # index, [id] (detail)
```

**Dev networking:** `core/config/env.ts` auto-detects the dev machine's LAN IP from `Constants.expoConfig?.hostUri` (Metro's address), strips the Metro port, and assumes backend on `:3000` — no manual IP config needed.

**Auth store (`features/auth/authStore.ts`):**
- Token stored in `expo-secure-store` (platform-secure)
- Cold start: `rehydrate()` restores token before any requests
- Logout: calls server-side endpoint first, then clears secure store and Zustand state

**API client non-obvious patterns:**
- Auth interceptor uses lazy import of authStore to avoid circular dependency
- 401 auto-logout has `isLoggingOut` guard to prevent cascade on concurrent failing requests
- All errors normalized to `AppError` type via `normalizeError()`
- 15-second timeout (3G-friendly)

---

## Storefront (`quick-vendor-store-front`)

**Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4

### Commands

```bash
yarn dev    # Dev server (localhost:3000)
yarn build  # Production build
yarn lint   # ESLint
```

**Route structure (planned):**
```
src/app/
  store/[slug]/page.tsx              # SSR — store page with product grid
  store/[slug]/[productId]/page.tsx  # SSR — product detail
  store/[slug]/checkout/page.tsx     # CSR — checkout form
  store/[slug]/checkout/confirm/     # Payment confirmation
  report/[vendorId]/page.tsx         # Report vendor (public)
```

Store and product pages are React Server Components (SSR) for SEO — `generateMetadata` provides OpenGraph tags for WhatsApp link previews. Checkout is CSR. Images use `next/image` (quality:60, AVIF/WebP) for 3G optimization.

**Env vars:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

---

## Admin (`quick-vendor-admin`)

**Stack:** Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui + TanStack React Query

Deployed separately to `admin.quickvendor.store`. Admin accounts are created via seed script — never through public registration. Uses the same backend JWT system with `AdminGuard` (checks `role === ADMIN || SUPER_ADMIN`).

---

## Infrastructure

**Deployment:**
- Frontends → Vercel (`store.quickvendor.store`, `admin.quickvendor.store`)
- Backend + DB + monitoring → Hetzner CPX22 VPS (2 AMD vCPU, 4GB RAM)
- Nginx reverse proxy + Let's Encrypt SSL
- `api.quickvendor.store` → nestjs-prod, `staging.api.quickvendor.store` → nestjs-staging
- Grafana at `grafana.quickvendor.store` (single instance, two Prometheus data sources for prod/staging)

**CI/CD:** Push to `main` → GitHub Actions → SSH deploy to staging → manual approval → deploy to prod. Vercel auto-deploys frontends.

**Docker layout on VPS:** `/opt/quickvendor/{prod,staging,monitoring,shared,nginx,certbot}/`

---

## Cross-Cutting Conventions

- **Prices always in kobo** (Int). Never use Float for money. Display: divide by 100 and format as `₦`.
- **WhatsApp deep links:** `https://wa.me/{e164number}?text=Hi, I'm interested in {productName}`
- **Nigerian phone numbers:** validated with custom `@IsNigerianPhone()` class-validator decorator, normalized to E.164 format
- **Prettier:** single quotes, trailing commas (all projects)
- **Rate limits:** Paystack webhook endpoint must be excluded from global throttler
- **Public endpoints** (storefront-facing): `POST /api/orders`, `GET /api/orders/:reference/verify`, `POST /api/reports` — these have no auth but are rate-limited
