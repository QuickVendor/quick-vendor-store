# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quick Vendor Store is a full-stack e-commerce/vendor platform consisting of four independent sub-projects (no root-level workspace config — each is managed separately):

- **`quick-vendor-nestjs-backend`** — NestJS + PostgreSQL API
- **`quick-vendor-mobile-app`** — Expo (React Native) mobile app
- **`quick-vendor-store-front`** — Next.js storefront (early stage)
- **`quick-vendor-admin`** — Admin panel (not yet implemented)

All projects use Yarn and TypeScript with strict mode.

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

Module-based NestJS architecture: `AuthModule`, `UsersModule`, `ProductsModule`, `StoreModule`, `FeedbackModule`, `StorageModule`, `PrismaModule`.

Each module follows the Service → Controller → DTO pattern. Global validation pipe enforces `whitelist: true` and `forbidNonWhitelisted: true`. Rate limiting via `ThrottlerModule` (20 req/min globally). File storage is local in development, S3 in production (via `StorageModule`).

**Data models:**
- `User` — has `storeSlug` (unique), `storeName`, `bannerUrl`, `whatsappNumber`; one-to-many with Products
- `Product` — has `price` (Float), up to 4 image URLs, `isAvailable`, `clickCount` (analytics)

Password hashing uses Argon2. JWTs are used for auth with `@UseGuards(JwtAuthGuard)` on protected routes.

---

## Mobile App (`quick-vendor-mobile-app`)

**Stack:** Expo 54, React Native 0.81.5, Expo Router 6 (file-based routing), Zustand, TanStack React Query, Axios

### Commands

```bash
yarn start      # Start Metro bundler
yarn android    # Android emulator
yarn ios        # iOS simulator
yarn web        # Web preview
yarn lint       # Lint
```

### Architecture

Feature-based structure under `src/`:

```
core/
  api/          # Axios HTTP client (auto-detects dev machine IP via Expo's hostUri)
  config/       # Environment config
  components/   # Shared components
  hooks/        # Shared hooks
features/
  auth/         # Zustand store + API + hooks
  products/     # API + hooks (useProducts)
  store/        # API + hooks (useStore, useStoreSummary)
theme/          # Colors, fonts, global styles
```

**Dev networking:** The API client auto-detects the developer machine's LAN IP from Expo's `hostUri`, so no manual IP config is needed when running the backend locally.

**State management:** Zustand for global auth state (`authStore.ts`). React Query for server state (products, store data).

---

## Storefront (`quick-vendor-store-front`)

**Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4

### Commands

```bash
yarn dev    # Dev server (localhost:3000)
yarn build  # Production build
yarn lint   # ESLint
```

Currently a minimal starter — the `src/app/` directory structure uses Next.js App Router with a root layout and home page.

---

## Environment & Configuration

Each sub-project has its own `.env` file. The backend has a `.env.example` with all required variables (database URL, JWT secret, storage config, Sentry DSN, etc.).

Prettier config (applies to all projects): single quotes, trailing commas.
