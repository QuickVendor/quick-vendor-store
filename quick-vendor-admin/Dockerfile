# ============================================
# Stage 1: Dependencies — installs yarn packages once, reused across builds
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000 \
 && yarn cache clean

# ============================================
# Stage 2: Builder — compiles Next.js into .next/standalone
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat

# NEXT_PUBLIC_* must be present at build time — they are inlined into client bundles.
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# INTERNAL_API_URL — server-side / docker-internal backend URL for SSR.
# Falls back to NEXT_PUBLIC_API_URL when unset (Railway/Vercel).
ARG INTERNAL_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public/ exists even if the project has no static assets — keeps the COPY in the runner stage idempotent.
RUN mkdir -p public && yarn build

# ============================================
# Stage 3: Runner — minimal production image
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root runtime user. Remove npm (not needed at runtime) to eliminate
# its bundled vulnerable transitive deps (tar, minimatch, cross-spawn, glob).
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Next.js standalone bundles server.js plus the pruned node_modules it actually needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
