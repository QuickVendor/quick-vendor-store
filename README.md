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
