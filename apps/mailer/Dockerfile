# Build context is the monorepo root.
FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /app


FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mailer/package.json ./apps/mailer/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --filter @github-notifier/mailer...

COPY packages/contracts ./packages/contracts
COPY apps/mailer ./apps/mailer

RUN pnpm --filter @github-notifier/mailer... build


FROM base AS production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mailer/package.json ./apps/mailer/
COPY packages/contracts/package.json ./packages/contracts/
RUN CI=1 pnpm install --frozen-lockfile --prod --filter @github-notifier/mailer...

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/mailer/dist ./apps/mailer/dist

WORKDIR /app/apps/mailer

CMD ["node", "dist/main.js"]
