# Quick Vendor Store

A full-stack vendor platform for the Nigerian market. Vendors create stores, list products, and accept payments via Paystack. Customers browse a public storefront, pay online, and contact vendors via WhatsApp.

## Sub-projects

| Project | Stack | Purpose |
|---------|-------|---------|
| `quick-vendor-nestjs-backend` | NestJS 11, PostgreSQL, Prisma | REST API |
| `quick-vendor-mobile-app` | Expo 54, React Native | Vendor mobile app |
| `quick-vendor-store-front` | Next.js 16 (App Router) | Public customer storefront |
| `quick-vendor-admin` | Next.js 16, shadcn/ui | Admin dashboard |

Each sub-project is independent — no root-level workspace. Run commands from inside each directory.

## Getting Started

### Backend

```bash
cd quick-vendor-nestjs-backend
cp .env.example .env       # Fill in required values
yarn quickvendor:dev       # Starts app + PostgreSQL via Docker Compose
```

Swagger docs available at `http://localhost:3000/docs`.

### Mobile App

```bash
cd quick-vendor-mobile-app
yarn start                 # Start Metro bundler
yarn android               # Run on Android emulator
yarn ios                   # Run on iOS simulator
```

The app auto-detects the backend's LAN IP via Expo's Metro host — no manual IP config needed when running the backend locally.

### Storefront

```bash
cd quick-vendor-store-front
yarn dev                   # http://localhost:3000
```

### Admin

```bash
cd quick-vendor-admin
yarn dev
```

## Architecture

- **Payments:** Paystack — vendors set up bank accounts, platform takes a 5% commission, Paystack settles to vendors automatically
- **Storage:** Local filesystem in dev, AWS S3 in production
- **Auth:** JWT (7-day expiry) + Argon2 password hashing + Redis token blocklist for logout
- **Prices:** All monetary values stored in **kobo** (smallest Naira unit: 100 kobo = ₦1)

## Deployment

- **Backend + DB:** Hetzner CPX22 VPS — `api.quickvendor.store`
- **Storefront + Admin:** Vercel — `store.quickvendor.store`, `admin.quickvendor.store`
- **CI/CD:** GitHub Actions → staging on push to `main`, manual approval for production

## Environment Variables

Each sub-project has its own `.env`. The backend `.env.example` documents all required variables including:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`
- `REDIS_URL`
- `STORAGE_DRIVER` — `local` or `s3`
- `ABSTRACT_API_KEY` — WhatsApp number validation
- `SLACK_WEBHOOK_URL` — Feedback and report notifications
- `SENTRY_DSN`
