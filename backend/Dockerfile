# Multi-stage production image for the NestJS API (Node 24 / ESM).
# Build from repo root: docker build -f backend/Dockerfile .

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend...

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend ./backend
WORKDIR /app/backend
RUN pnpm exec prisma generate && pnpm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate \
  && addgroup -S thekra && adduser -S thekra -G thekra
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend_node_modules
# Prefer package-local modules when present
ENV NODE_PATH=/app/backend_node_modules:/app/node_modules
USER thekra
EXPOSE 3001
# The bundle, not dist/main.js: plain Node cannot load @thekra/practice-core (TypeScript source).
CMD ["node", "dist/bundle/main.mjs"]
