# GitHub Release Notifier

A self-hosted service that sends email notifications when a GitHub repository publishes a new release. Users subscribe to repositories via a REST API and receive a confirmation email. Once confirmed, they are notified whenever a new release tag is detected.

## How it works

1. A user subscribes to a repository by providing their email and the `owner/repo` slug.
2. The service validates the repository exists on GitHub and sends a confirmation email.
3. The user clicks the confirmation link to activate the subscription.
4. A background scanner polls GitHub for new releases at a configurable interval.
5. When a new release is detected, all confirmed subscribers receive an email with a link to the release.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript |
| Framework | Fastify 5 |
| Database | PostgreSQL 16 |
| Query builder | Kysely |
| Migrations | Prisma (migrations only) |
| Email | Nodemailer |
| Testing | Vitest |
| Observability | Prometheus + Grafana |

## Project structure

```
src/
├── server.ts                        # Entry point
├── app.ts                           # Fastify app factory
├── common/
│   ├── constants/pgErrorCodes.ts    # PostgreSQL error codes
│   └── errors/                      # Domain error types
├── modules/
│   ├── scanner/
│   │   ├── scanner.service.ts       # Release polling logic
│   │   └── scanner.plugin.ts        # Scheduler lifecycle (setInterval, onReady)
│   └── subscription/
│       ├── subscription.controller.ts
│       ├── subscription.service.ts
│       └── schemas/                 # Request validation schemas
└── plugins/
    ├── config/env.ts                # Environment variable validation
    ├── infrastructure/
    │   ├── database/                # Kysely client + generated types
    │   ├── github/octokit.ts        # Octokit client
    │   └── mail/transporter.ts      # Nodemailer + concurrency queue
    ├── repositories/
    │   ├── gh-repo.repository.ts
    │   └── subscription.repository.ts
    └── services/
        ├── github.service.ts
        └── mail.service.ts
```

## API

### `POST /api/subscribe`

Subscribe an email address to release notifications for a repository.

**Request body**

```json
{
  "email": "you@example.com",
  "repository": "owner/repo"
}
```

**Validation**
- `email` — valid email format
- `repository` — must match the `owner/repo` pattern
- The repository must exist on GitHub
- Duplicate subscriptions return `409 Conflict`

**Response**

```json
{ "message": "Subscription successful. Confirmation email sent." }
```

---

### `GET /api/confirm/:token`

Confirms a subscription. The token is included in the confirmation email.

**Response**

```json
{ "message": "Subscription confirmed" }
```

---

### `GET /api/unsubscribe/:token`

Unsubscribes and permanently deletes the subscription. The token is included in every notification email.

**Response**

```json
{ "message": "Unsubscribed successfully" }
```

---

### `GET /api/subscriptions?email=you@example.com`

Returns all confirmed subscriptions for a given email address.

**Response**

```json
[
  { "id": "uuid", "email": "you@example.com", "repository": "owner/repo" }
]
```

---

### `GET /metrics`

Exposes Prometheus metrics (HTTP request counts, latencies, etc.).

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | PostgreSQL user | — |
| `POSTGRES_PASSWORD` | PostgreSQL password | — |
| `POSTGRES_DATABASE` | Database name | — |
| `DATABASE_URL` | Full connection string (used by Prisma) | — |
| `GITHUB_TOKEN` | GitHub personal access token | — |
| `MAIL_HOST` | SMTP host | — |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USER` | SMTP username (leave empty to skip auth) | — |
| `MAIL_PASS` | SMTP password | — |
| `APP_URL` | Public base URL of the service (used in email links) | `http://localhost:3000` |
| `SCAN_INTERVAL` | How often to poll GitHub for new releases, in minutes | `5` |

### GitHub token

The token needs `public_repo` scope (or no scope at all for public repositories). Create one at **GitHub → Settings → Developer settings → Personal access tokens**.

## Running with Docker

The recommended way to run the full stack locally.

```bash
# Clone and configure
git clone https://github.com/matshp0/GithubRealeaseNotifier.git
cd GithubRealeaseNotifier
cp .env.example .env
# Set GITHUB_TOKEN in .env

# Start everything
docker compose up --build
```

This starts:

| Service | URL | Description |
|---|---|---|
| App | http://localhost:3000 | REST API |
| Mailpit | http://localhost:8025 | Email inspector UI |
| Prometheus | http://localhost:9090 | Metrics scraper |
| Grafana | http://localhost:3001 | Dashboards (admin / admin) |
| PostgreSQL | localhost:5432 | Database |

Database migrations run automatically via the `migrate` service on startup.

## Monorepo layout

This is a pnpm + turborepo monorepo:

- `apps/api` — the Fastify HTTP service (the main application).
- `packages/*` — shared packages (added as needed).

Root scripts (`build`, `lint`, `test`, `dev`, ...) run through turbo across all
workspaces. Run a single app's script with `pnpm --filter @github-notifier/api <script>`.

## Running locally (without Docker)

Prerequisites: Node.js 22, pnpm (via `corepack enable`), a running PostgreSQL instance, an SMTP server (e.g. Mailpit).

```bash
pnpm install

# Run migrations
pnpm db:migrate

# Start with hot reload
pnpm dev
```

## Database migrations

Prisma is used exclusively for migrations. Runtime queries go through Kysely.

```bash
# Create a new migration (development)
pnpm db:migrate

# Apply pending migrations (production / CI)
pnpm db:migrate:deploy

# Check migration status
pnpm db:migrate:status
```

## Testing

```bash
# Run all unit tests
pnpm test

# Watch mode
pnpm exec vitest
```

Tests are written with Vitest and use in-memory mocks — no database or network required.

## Linting and formatting

```bash
pnpm lint        # Check
pnpm lint:fix    # Fix auto-fixable issues
pnpm format      # Prettier
```

## CI

GitHub Actions runs linting and tests on every push and pull request (`.github/workflows/ci.yml`).

## Observability

The service exposes Prometheus metrics at `/metrics`. When running via Docker Compose, Prometheus scrapes this endpoint every 15 seconds and Grafana is pre-configured with Prometheus as the default datasource.

To explore metrics in Grafana:
1. Open http://localhost:3001 and log in with `admin` / `admin`
2. Go to **Explore** → select the **Prometheus** datasource
3. Query metrics such as `http_request_duration_seconds_count` or `http_requests_total`

## Architecture notes

**Plugin loading order**

Fastify plugins are loaded in five sequential autoload passes to satisfy dependency declarations:

```
config → infrastructure → repositories → services → modules
```

**Background scanner**

The scanner uses `setInterval` started in the `onReady` hook. An `isScanning` flag prevents overlapping runs. GitHub API calls use ETags so unchanged repositories result in `304 Not Modified` responses and count against the rate limit minimally.

**Rate limiting**

On a `429 Too Many Requests` response the scanner reads the `Retry-After` or `x-ratelimit-reset` header and suspends all GitHub calls until the reset time passes.

**Email queue**

Outbound emails go through an in-process queue with a concurrency limit of 5 to avoid overwhelming the SMTP connection. On graceful shutdown (`SIGTERM`) the server waits for the queue to drain before closing.
