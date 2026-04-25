# ============================================
# Stage 1: Base — install deps + generate Prisma client
# ============================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn \
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
# Stage 4: Production — lean runtime (non-root)
#   All artefacts are COPY --chown'd in place. Avoids the slow recursive chown
#   over node_modules that ran on every build previously.
# ============================================
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl

# Create the runtime user first so the numeric UID 1001 resolves during COPY --chown.
RUN addgroup -S -g 1001 appgroup \
 && adduser -S -u 1001 -G appgroup appuser

COPY --from=build --chown=1001:1001 /app/dist ./dist
COPY --from=build --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=build --chown=1001:1001 /app/prisma ./prisma
COPY --chown=1001:1001 package.json ./

RUN mkdir -p uploads && chown 1001:1001 uploads

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
