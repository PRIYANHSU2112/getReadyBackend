# Salon — Node.js MVRSC Modular Monolith

Production-oriented **Express** backend boilerplate using **MVRSC** (Model, Validation, Repository, Service, Controller), class-based code, and a modular monolith layout.

## Features

- Node.js 22 (LTS) + Express (ESM)
- MongoDB (Mongoose) with dedicated `core/database`
- Redis singleton (cache + pub/sub)
- Socket.IO + Redis adapter (JWT auth, rooms, presence)
- BullMQ queues + separate cron jobs
- JWT auth
- Helmet, CORS, rate limit, XSS, NoSQL sanitize, HPP
- Pino logging, global error handling, Joi validation
- Swagger/OpenAPI
- Storage facade (S3)
- In-process EventBus for cross-module events
- Prometheus metrics + Grafana sample dashboard
- Jest + Supertest
- Docker Compose + GitHub Actions CI

## Quick start

```bash
cp .env.example .env
npm install
# start MongoDB + Redis locally, or:
docker compose up -d mongodb redis
npm run dev
```

API: `http://localhost:3000`  
Docs: `http://localhost:3000/api-docs`  
Health: `http://localhost:3000/health`

Full stack (API + Mongo + Redis + Prometheus + Grafana):

```bash
docker compose up --build
```

## Project structure

```
src/
  core/       # infrastructure (config, db, redis, socket, queue, storage, events, di, …)
  common/     # base classes, constants/enums, errors, middleware, utils
  modules/    # feature modules (user, notification)
  routes/     # API version mounts
  tests/      # unit / integration / repository / service / controller / socket
docs/         # architecture, deployment, API notes
```

Every feature module keeps the same shape:

`model → validation → repository → service → controller → routes → docs → index`

## Sample flow

1. `POST /api/v1/users` — create a user
2. `POST /api/v1/users/login` — receive JWT
3. `GET /api/v1/users` with `Authorization: Bearer <token>`

Creating a user emits `user.created`; the notification module listens via EventBus (no cross-module repository imports).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode |
| `npm start` | Production start |
| `npm test` | Jest |
| `npm run lint` | ESLint |

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [API](docs/api.md)

## License

MIT
