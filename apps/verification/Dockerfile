# Build context is the monorepo root.
FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /app


FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/verification/package.json ./apps/verification/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --filter @github-notifier/verification...

COPY packages/contracts ./packages/contracts
COPY apps/verification ./apps/verification

RUN pnpm --filter @github-notifier/verification... build


FROM base AS migrator

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/verification/package.json ./apps/verification/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --filter @github-notifier/verification...

COPY apps/verification/prisma ./apps/verification/prisma
COPY apps/verification/prisma.config.ts ./apps/verification/prisma.config.ts

WORKDIR /app/apps/verification

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]


FROM base AS production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/verification/package.json ./apps/verification/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --prod --filter @github-notifier/verification...

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/verification/dist ./apps/verification/dist

WORKDIR /app/apps/verification

EXPOSE 3002

CMD ["node", "dist/server.js"]
