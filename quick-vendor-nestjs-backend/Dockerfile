# ============================================
# Stage 1: Base — shared dependencies
# ============================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY prisma ./prisma/
RUN npx prisma generate

# ============================================
# Stage 2: Development — hot-reload via nest
# ============================================
FROM base AS development
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["yarn", "dev"]

# ============================================
# Stage 3: Build — compile TypeScript
# ============================================
FROM base AS build
WORKDIR /app
COPY . .
RUN yarn build

# ============================================
# Stage 4: Production — lean runtime
# ============================================
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
RUN mkdir -p uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
