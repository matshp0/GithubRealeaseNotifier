# Build context is the monorepo root.
FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /app


FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --filter @github-notifier/api...

COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN pnpm --filter @github-notifier/api... build


FROM base AS migrator

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --filter @github-notifier/api...

COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]


FROM base AS production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --prod --filter @github-notifier/api...

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/server.js"]
