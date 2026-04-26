# ============================================
# Stage 1: Base — install ALL deps + generate Prisma client
# ============================================
FROM node:20-alpine AS base
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache openssl
COPY package.json yarn.lock ./
# id=qv-backend-yarn: Railway's BuildKit requires an explicit cache id.
# sharing=locked: serialize cache writes with the parallel prod-deps stage
# (both target /root/.yarn; default sharing=shared corrupts entries under race).
# hadolint ignore=DL3060
RUN --mount=type=cache,id=qv-backend-yarn,target=/root/.yarn,sharing=locked \
    YARN_CACHE_FOLDER=/root/.yarn \
    yarn install --frozen-lockfile --network-timeout 300000
COPY prisma ./prisma/
RUN npx prisma generate

# ============================================
# Stage 2: Development — hot reload
# ============================================
FROM base AS development
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["yarn", "dev"]

# ============================================
# Stage 3: Build — compile TypeScript
#   Scoped COPY: changes outside src/tsconfig*/nest-cli.json don't invalidate this layer,
#   so edits to README/compose/etc skip the TypeScript rebuild entirely.
# ============================================
FROM base AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/
RUN npx nest build

# ============================================
# Stage 4: Prod-deps — production-only node_modules
#   Separate stage so the production image never sees devDependencies
#   (eslint, jest, @nestjs/cli, ts-*, etc.) that cause CVE noise.
# ============================================
FROM node:20-alpine AS prod-deps
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache openssl
COPY package.json yarn.lock ./
# id matches stage 1 so both share the same cache; sharing=locked serializes.
# hadolint ignore=DL3060
RUN --mount=type=cache,id=qv-backend-yarn,target=/root/.yarn,sharing=locked \
    YARN_CACHE_FOLDER=/root/.yarn \
    yarn install --frozen-lockfile --production --network-timeout 300000

# ============================================
# Stage 5: Production — lean runtime (non-root)
#   node_modules comes from prod-deps (production only).
#   Generated Prisma client is overlaid from the build stage.
# ============================================
FROM node:20-alpine AS production
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache openssl

# Create the runtime user. Remove npm (not needed at runtime) to eliminate
# its bundled vulnerable transitive deps (tar, minimatch, cross-spawn, glob).
RUN addgroup -S -g 1001 appgroup \
 && adduser -S -u 1001 -G appgroup appuser \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# 1. Production-only node_modules (no devDependencies)
COPY --from=prod-deps --chown=1001:1001 /app/node_modules ./node_modules

# 2. Overlay generated Prisma client from the build stage
COPY --from=build --chown=1001:1001 /app/node_modules/.prisma ./node_modules/.prisma

# 3. Compiled application + Prisma schema (for migrate deploy)
COPY --from=build --chown=1001:1001 /app/dist ./dist
COPY --from=build --chown=1001:1001 /app/prisma ./prisma
COPY --chown=1001:1001 package.json ./

RUN mkdir -p uploads && chown 1001:1001 uploads

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use node to invoke prisma directly (npx was removed above).
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
