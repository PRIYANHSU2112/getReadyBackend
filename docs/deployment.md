# Deployment

## Prerequisites

- Node.js 22+
- Docker & Docker Compose (recommended)

## Environment

Copy `.env.example` to `.env` and set secrets:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` \| `test` \| `staging` \| `production` |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection |
| `JWT_SECRET` | Min 16 characters |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `cloudinary` |

Env-specific overrides live in `src/core/config/environments/`.

## Docker Compose (full stack)

```bash
cp .env.example .env
docker compose up --build
```

Services:

| Service | Port |
|---------|------|
| API | 3000 |
| MongoDB | 27017 |
| Redis | 6379 |
| Prometheus | 9090 |
| Grafana | 3001 (admin/admin) |

## Health checks

- `GET /health` — liveness
- `GET /ready` — MongoDB + Redis readiness
- `GET /metrics` — Prometheus scrape (when enabled)

## Graceful shutdown

`SIGTERM` / `SIGINT` close HTTP, Socket.IO, cron, BullMQ workers/queues, Redis, and MongoDB.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, and `docker compose build`.
