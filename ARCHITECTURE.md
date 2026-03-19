# Quick Vendor Store — System Architecture Plan

## Context

Quick Vendor is a platform targeting the **Nigerian market** that enables vendors to create stores, list products, and share a storefront URL with customers. Customers browse, purchase products via online payment, and communicate with vendors via WhatsApp. The platform needs admin oversight to monitor vendors, handle reports, and take action against bad actors.

**What exists today:**
- **Backend** (NestJS 11 + PostgreSQL + Prisma): Auth, Users, Products, Store (public), Feedback, Storage modules — all functional
- **Mobile App** (Expo/React Native): Vendor-facing app with auth, dashboard, product CRUD, store settings — all functional
- **Storefront** (Next.js 16): Empty scaffold, no business logic
- **Admin** (`quick-vendor-admin/`): Empty directory

**What's missing:** Payment system, order management, storefront UI, admin dashboard, customer reporting, WhatsApp validation.

---

## 1. Database Schema Evolution

**File:** `quick-vendor-nestjs-backend/prisma/schema.prisma`

### New Enums

```prisma
enum UserRole    { VENDOR  ADMIN  SUPER_ADMIN }
enum UserStatus  { ACTIVE  SUSPENDED  CLOSED  DELETED }
enum OrderStatus { PENDING  PAID  CONFIRMED  FULFILLED  EXPIRED  REFUNDED  CANCELLED }
enum ReportCategory { FRAUD  COUNTERFEIT_GOODS  NON_DELIVERY  POOR_QUALITY  HARASSMENT  WRONG_ITEM  OTHER }
enum ReportStatus   { OPEN  UNDER_REVIEW  RESOLVED  DISMISSED }
```

### User Model — New Fields

```prisma
role                   UserRole   @default(VENDOR)
status                 UserStatus @default(ACTIVE)
whatsappVerified       Boolean?   @map("whatsapp_verified")
paystackSubaccountCode String?    @map("paystack_subaccount_code")
bankCode               String?    @map("bank_code")
bankAccountNumber      String?    @map("bank_account_number")
bankAccountName        String?    @map("bank_account_name")
paymentSetupComplete   Boolean    @default(false) @map("payment_setup_complete")
suspendedAt            DateTime?  @map("suspended_at")
suspensionReason       String?    @map("suspension_reason")
deletedAt              DateTime?  @map("deleted_at")
lastLoginAt            DateTime?  @map("last_login_at")
// new relations
orders                 Order[]    @relation("VendorOrders")
reportsAgainst         Report[]   @relation("ReportsAgainst")
```

### New: Order Model

```prisma
model Order {
  id                String      @id @default(uuid())
  reference         String      @unique                         // unique order ref
  vendorId          String      @map("vendor_id")
  vendor            User        @relation("VendorOrders", fields: [vendorId], references: [id])
  productId         String      @map("product_id")
  product           Product     @relation(fields: [productId], references: [id])
  quantity          Int         @default(1)
  amount            Int                                         // kobo (Naira × 100)
  status            OrderStatus @default(PENDING)
  customerEmail     String      @map("customer_email")
  customerName      String      @map("customer_name")
  customerPhone     String?     @map("customer_phone")
  paystackReference String?     @map("paystack_reference")
  paidAt            DateTime?   @map("paid_at")
  confirmedAt       DateTime?   @map("confirmed_at")
  fulfilledAt       DateTime?   @map("fulfilled_at")
  cancelledAt       DateTime?   @map("cancelled_at")
  refundedAt        DateTime?   @map("refunded_at")
  reports           Report[]
  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime?   @updatedAt @map("updated_at")
  @@map("orders")
}
```

### New: Report Model

```prisma
model Report {
  id            String         @id @default(uuid())
  vendorId      String         @map("vendor_id")
  vendor        User           @relation("ReportsAgainst", fields: [vendorId], references: [id])
  category      ReportCategory
  description   String
  customerEmail String         @map("customer_email")
  customerPhone String?        @map("customer_phone")
  orderId       String?        @map("order_id")
  order         Order?         @relation(fields: [orderId], references: [id])
  status        ReportStatus   @default(OPEN)
  adminNotes    String?        @map("admin_notes")
  resolvedAt    DateTime?      @map("resolved_at")
  resolvedBy    String?        @map("resolved_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime?      @updatedAt @map("updated_at")
  @@map("reports")
}
```

### Product Model — Add `orders Order[]` relation

### Price Migration

Change `Product.price` from `Float` to `Int` (store in **kobo** — smallest Naira unit). This matches Paystack's API format and avoids floating-point precision bugs. Requires a data migration: `UPDATE products SET price = price * 100`.

---

## 2. Payment System (Paystack)

**Why Paystack:** Dominant in Nigeria, Naira-native, supports subaccounts for automatic split settlement, bank transfer/USSD/card payments, excellent webhook reliability.

### How It Works

1. **Vendor payment setup** (mobile app → backend):
   - Vendor provides bank details (bank code + account number)
   - Backend verifies account name via `GET paystack.co/bank/resolve`
   - Backend creates a Paystack subaccount via `POST paystack.co/subaccount`
   - Platform fee (e.g. 5%) configured as `percentage_charge` on the subaccount
   - Paystack settles to vendor's bank on T+1 automatically

2. **Customer checkout** (storefront → backend → Paystack):
   - Customer clicks "Buy Now" → enters name, email, phone
   - `POST /api/orders` creates an Order (PENDING) and calls Paystack Initialize Transaction
   - Returns Paystack's `authorization_url` → storefront redirects customer to Paystack hosted page
   - Customer pays (card, bank transfer, USSD)
   - Paystack redirects back to confirmation page

3. **Payment confirmation** (Paystack webhook → backend):
   - `POST /api/payments/webhook` receives `charge.success` event
   - Verifies signature: `HMAC-SHA512(body, secret)` vs `x-paystack-signature` header
   - Updates Order status to PAID, records timestamp
   - Must be **idempotent** (same event delivered twice = no double processing)
   - Must be **excluded from ThrottlerGuard**

4. **Order lifecycle:**
   ```
   PENDING → PAID → CONFIRMED → FULFILLED
      ↓        ↓        ↓
   EXPIRED  REFUNDED  CANCELLED
   ```
   - PENDING orders auto-expire after 30 min (NestJS `@Cron` scheduled task)
   - Vendor confirms/fulfills via mobile app
   - Refunds via `POST paystack.co/refund` (vendor or admin initiated)

### New Backend Modules

**PaymentsModule** (`src/payments/`):
```
POST  /api/payments/setup            — vendor bank details → Paystack subaccount
GET   /api/payments/banks            — list Nigerian banks (cached proxy to Paystack)
POST  /api/payments/verify-account   — verify bank account name
POST  /api/payments/webhook          — Paystack webhook receiver (signature-verified, no auth)
POST  /api/payments/refund/:orderId  — initiate refund
```

**OrdersModule** (`src/orders/`):
```
POST  /api/orders                     — create order + init Paystack transaction (public)
GET   /api/orders/:reference/verify   — verify payment status (public)
GET   /api/orders/vendor              — vendor's order list (auth)
GET   /api/orders/vendor/:id          — vendor order detail (auth)
PATCH /api/orders/vendor/:id/confirm  — vendor confirms (auth)
PATCH /api/orders/vendor/:id/fulfill  — vendor marks fulfilled (auth)
PATCH /api/orders/vendor/:id/cancel   — vendor cancels (auth)
```

### New Env Vars
```
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_WEBHOOK_SECRET=whsk_xxx
PLATFORM_FEE_PERCENTAGE=5
```

---

## 3. WhatsApp Number Validation

### Three-Layer Approach

| Layer | What | When | Cost |
|-------|------|------|------|
| **Format validation** | Regex for Nigerian numbers (+234...), normalize to E.164 | Registration & settings update | Free |
| **Bank identity check** | Paystack `bank/resolve` confirms real person | Payment setup | Free (part of Paystack) |
| **WhatsApp reachability** | Abstract API checks if number is registered on WhatsApp | Async after settings update | ~$0.01/lookup |

### Implementation

- Add `@IsNigerianPhone()` custom class-validator decorator in backend DTOs (server-side format validation)
- **WhatsAppValidationModule** (`src/whatsapp-validation/`): service-only module wrapping Abstract API
- Validation is **async and non-blocking** — never block registration or settings updates
- Sets `User.whatsappVerified` to `true`/`false`/`null` (null = not yet checked)
- Storefront shows a "Verified" badge on the WhatsApp button if verified

### New Env Vars
```
ABSTRACT_API_KEY=xxx
WHATSAPP_VALIDATION_ENABLED=true
```

---

## 4. Storefront Architecture (Next.js 16)

**Directory:** `quick-vendor-store-front/`

### Route Structure

```
src/app/
  layout.tsx                        — root layout (fonts, global metadata)
  page.tsx                          — landing page (quickvendor.com)
  store/
    [slug]/
      page.tsx                      — store page (SSR): banner, vendor info, product grid
      [productId]/
        page.tsx                    — product detail (SSR): images, description, buy/WhatsApp buttons
      checkout/
        page.tsx                    — checkout form (CSR): customer info → pay
        confirm/
          page.tsx                  — payment confirmation
  report/
    [vendorId]/
      page.tsx                      — report vendor form (public)
```

### Key Design Decisions

- **Store & product pages are SSR** (React Server Components) for SEO — Google must index these
- **Checkout is CSR** (client-side) — no SEO needed, needs interactivity
- **`generateMetadata`** on store/product pages for OpenGraph (WhatsApp link previews matter hugely in Nigeria)
- **Aggressive image optimization**: `next/image` with quality:60, AVIF/WebP, max 400px grid / 800px detail
- **Minimal JS bundle**: leverage RSC to keep client-side JS small (3G optimization)
- **WhatsApp deep links**: "Ask about this on WhatsApp" button → `https://wa.me/{number}?text=Hi, I'm interested in {productName}`

### Store Page Layout

1. Banner image (lazy, blurred placeholder)
2. Store name + WhatsApp contact button (green, prominent, with verified badge if applicable)
3. Product grid (2-col mobile, 3-col desktop): image, name, price (₦), "Buy Now"
4. Footer: "Report this vendor" link, "Powered by QuickVendor"

### `next.config.ts` Updates Needed

- `images.remotePatterns` for S3 bucket and backend `/uploads` paths
- Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

---

## 5. Admin Dashboard

**Directory:** `quick-vendor-admin/` — **Separate Next.js 16 app**

### Why Separate

- Different deployment target (`admin.quickvendor.com`)
- Different access control (admin-only, not public)
- Can use heavier UI libraries without affecting storefront bundle size
- Independent deploy cadence

### Stack

Next.js 16 (App Router) + Tailwind CSS 4 + **shadcn/ui** (tables, modals, charts) + TanStack React Query

### Auth

Extend existing User model with `role` enum (VENDOR/ADMIN/SUPER_ADMIN). Same JWT system, new `AdminGuard`:
```typescript
// Checks req.user.role === 'ADMIN' || 'SUPER_ADMIN'
```
Admin accounts created via seed script or CLI command — never through public registration.

### Admin API Endpoints (new `AdminModule` in backend)

```
GET    /api/admin/vendors              — paginated vendor list (search, filter by status)
GET    /api/admin/vendors/:id          — vendor detail (products, orders, reports)
PATCH  /api/admin/vendors/:id/suspend  — suspend vendor (sets status, reason)
PATCH  /api/admin/vendors/:id/unsuspend
DELETE /api/admin/vendors/:id          — soft delete
GET    /api/admin/orders               — all platform orders
GET    /api/admin/reports              — customer reports (filtered, paginated)
PATCH  /api/admin/reports/:id          — update report status, add admin notes
GET    /api/admin/analytics            — platform stats (revenue, vendor count, orders)
```

### Vendor Status Workflow

| Action | Who | Effect |
|--------|-----|--------|
| **Suspend** | ADMIN+ | `status=SUSPENDED`, store returns 410, mobile app shows banner, all actions disabled |
| **Unsuspend** | ADMIN+ | `status=ACTIVE`, store accessible again |
| **Close** | Vendor | `status=CLOSED`, store inaccessible, data retained 90 days |
| **Delete** | SUPER_ADMIN | `status=DELETED`, soft delete, hard delete after 30 days |

### Auto-Escalation Rule

If a vendor receives **3+ OPEN reports within 30 days**, auto-flag for immediate admin review.

---

## 6. Customer Reporting System

### Report Flow

1. Customer clicks "Report this vendor" on storefront → `/report/{vendorId}` page
2. Fills form: category (dropdown), description, email (required for follow-up), optional order reference
3. `POST /api/reports` — public endpoint, rate-limited (3/IP/hour)
4. Slack notification sent to admin channel (reuses existing FeedbackModule pattern)
5. Admin reviews in dashboard → actions: dismiss, warn vendor, suspend vendor, initiate refund

### New Backend Module

**ReportsModule** (`src/reports/`):
```
POST  /api/reports                — customer submits (public, rate-limited)
GET   /api/admin/reports          — admin list (paginated, filtered)
GET   /api/admin/reports/:id      — admin detail
PATCH /api/admin/reports/:id      — admin updates status/notes
```

---

## 7. Mobile App Updates Needed

### New Screens

- **Payment Setup** (in Settings): Bank name dropdown, account number input, verified account name display, save
- **Orders Tab** (new bottom tab): List of incoming orders with status badges, pull-to-refresh
- **Order Detail**: Customer info, product, amount, status timeline, action buttons (Confirm/Fulfill/Cancel)
- **Account Status Banner**: Shows suspension notice if `user.status === SUSPENDED`

### API Integration

- New hooks: `useOrders()`, `useOrderActions()`, `usePaymentSetup()`
- Update `User` type to include new fields (role, status, paymentSetupComplete, etc.)
- Update dashboard to show order stats alongside existing product stats

---

## 8. Implementation Phases

### Phase 1: Schema + Payments + Storefront Core (Priority: Highest)

**Goal:** Customer can visit a store, view products, and pay.

1. Prisma migration: add enums, extend User, add Order model, migrate price to kobo
2. Build PaymentsModule (Paystack client, subaccount creation, webhook handler)
3. Build OrdersModule (create order, verify, vendor list/actions)
4. Build storefront: `/store/[slug]`, `/store/[slug]/[productId]`, checkout flow
5. Mobile app: payment setup screen, orders tab

### Phase 2: WhatsApp + Vendor Order Management

**Goal:** Vendors manage orders, WhatsApp is validated.

1. WhatsAppValidationModule (Abstract API integration)
2. Backend: `@IsNigerianPhone()` decorator, async validation on settings update
3. Storefront: WhatsApp deep link buttons with verified badge
4. Mobile app: order detail with confirm/fulfill/cancel actions
5. Scheduled task: expire PENDING orders after 30 minutes

### Phase 3: Admin Dashboard + Reporting

**Goal:** Platform operators can monitor and act.

1. Initialize `quick-vendor-admin/` as Next.js + shadcn/ui project
2. Build AdminModule in backend (all admin endpoints)
3. Build ReportsModule in backend
4. Admin UI: login, vendor management, reports, analytics
5. Storefront: report vendor form page

### Phase 4: Hardening

1. Redis for token blocklist (required for multi-instance)
2. Email notifications (order confirmation, suspension notices) via Resend/Mailgun
3. Sentry for storefront + admin
4. SEO: sitemap, JSON-LD structured data, OpenGraph
5. 3G load testing and bundle optimization

---

## 9. Verification Plan

### Phase 1 Testing
- Create a test vendor via mobile app → set up payment (bank details) → verify Paystack subaccount created
- Visit storefront at `/store/{slug}` → verify SSR renders store with products
- Click "Buy Now" → complete checkout with Paystack test card (`4084 0840 8408 4081`) → verify order status transitions
- Check Paystack webhook delivery → verify order marked PAID in database
- Verify vendor sees order in mobile app

### Phase 2 Testing
- Update WhatsApp number in settings → verify Abstract API called → verify `whatsappVerified` field updated
- Visit storefront → verify WhatsApp button links to `wa.me/{number}` with pre-filled message
- Create a PENDING order → wait 30 min → verify auto-expired

### Phase 3 Testing
- Login to admin dashboard with admin credentials
- View vendor list → search/filter → view vendor detail
- Suspend a vendor → verify store returns 410 → unsuspend → verify store accessible
- Submit a report from storefront → verify appears in admin dashboard → resolve it

### Phase 4 Testing
- Deploy multi-instance behind load balancer → verify token blocklist works via Redis
- Send test emails (order confirmation, suspension notice)
- Run Lighthouse on storefront pages → target 90+ performance score
- Test on throttled 3G connection (Chrome DevTools)
