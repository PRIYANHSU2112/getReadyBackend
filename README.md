# GetReady — Production Microservices Architecture

Production-grade **Microservices Backend Architecture** for the GetReady platform, built with Node.js 22 (LTS), Express, MongoDB (isolated database-per-service), Redis distributed locks/cache, and RabbitMQ event streaming with Transactional Outbox, Exponential Backoff Retries, and Dead Letter Queues (DLQ).

---

## Architecture Highlights

- **API Gateway**: Single reverse proxy entrypoint on port 3000 / 8080 with rate limiting, correlation ID injection, and JWT identity decoding.
- **12 Microservices**: Independently deployable Node.js services with database-per-service isolation.
- **7 Shared Infrastructure Packages**: Standardized error handling, logging, tracing, metrics, validation, configuration, and RabbitMQ messaging.
- **Asynchronous Messaging**: RabbitMQ topic exchange (`getready.domain.events`), Transactional Outbox pattern, Exponential Backoff retry queues, and Dead Letter Queues (DLQ).
- **Full Observability**: Prometheus scraping, 5 Grafana dashboards, Loki log aggregation, and end-to-end correlation ID tracking (`x-correlation-id`).

---

## Directory Structure

```
Backend/
├── services/
│   ├── api-gateway/            # Port 3000 / 8080 (Public entry point)
│   ├── auth-service/           # Port 3001 (DB: getready_auth)
│   ├── user-service/           # Port 3002 (DB: getready_user)
│   ├── beautician-service/     # Port 3003 (DB: getready_beautician)
│   ├── catalog-service/        # Port 3004 (DB: getready_catalog)
│   ├── booking-service/        # Port 3005 (DB: getready_booking)
│   ├── cart-service/           # Port 3006 (DB: getready_cart)
│   ├── payment-service/        # Port 3007 (DB: getready_payment)
│   ├── wallet-service/         # Port 3008 (DB: getready_wallet)
│   ├── notification-service/   # Port 3009 (DB: getready_notification)
│   ├── content-service/        # Port 3010 (DB: getready_content)
│   └── worker-service/         # Port 3011 (Background jobs & DLQ monitor)
│
├── packages/
│   ├── config/                 # Centralized configuration loader
│   ├── errors/                 # Standardized AppError, HttpStatus, ErrorCodes, ApiResponse
│   ├── logger/                 # Structured JSON Pino logging with PII redaction
│   ├── metrics/                # Prom-client registry and HTTP/DB histograms
│   ├── rabbitmq/               # Connection manager, Outbox, Retry, DLQ, Idempotency
│   ├── tracing/                # Correlation ID & AsyncLocalStorage context
│   └── validation/             # Joi request validation middleware
│
├── monitoring/
│   ├── prometheus/             # Prometheus scrape configs
│   ├── grafana/                # Provisioned datasources and dashboards
│   └── loki/                   # Loki log aggregator configuration
│
├── scripts/                    # Database seeds and management tools
├── postman/                    # Postman collection
├── tests/                      # Microservice integration & concurrency test suites
├── docker-compose.yml          # Full multi-container composition
└── README.md
```

---

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
npm install
```

### 2. Run with Docker Compose (Full Stack)

```bash
docker compose up -d
```

Services exposed:
- **API Gateway**: `http://localhost:3000` (or `8080`)
- **RabbitMQ Management**: `http://localhost:15672` (guest / guest)
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001` (admin / admin)
- **Loki**: `http://localhost:3100`

### 3. Run Tests

```bash
npm test
```

### 4. Database Seeding

```bash
npm run seed:rbac
npm run seed:super-admin
```

---

## Available NPM Scripts

| Script | Description |
|---|---|
| `npm test` | Run all microservice test suites in band |
| `npm run start:gateway` | Start API Gateway |
| `npm run start:auth` | Start Auth Service |
| `npm run start:user` | Start User Service |
| `npm run start:beautician` | Start Beautician Service |
| `npm run start:catalog` | Start Catalog Service |
| `npm run start:booking` | Start Booking Service |
| `npm run start:cart` | Start Cart Service |
| `npm run start:payment` | Start Payment Service |
| `npm run start:wallet` | Start Wallet Service |
| `npm run start:notification` | Start Notification Service |
| `npm run start:content` | Start Content Service |
| `npm run start:worker` | Start Worker Service |
| `npm run docker:up` | Launch Docker Compose ecosystem |
| `npm run docker:down` | Stop Docker Compose ecosystem |

---

## Architecture Documentation

Detailed documentation available under `docs/architecture/`:
- `01-current-architecture.md`
- `02-target-architecture.md`
- `03-service-boundaries.md`
- `04-service-dependencies.md`
- `05-database-ownership-matrix.md`
- `06-rabbitmq-architecture.md`
- `07-rabbitmq-event-catalog.md`
- `08-rabbitmq-retry-dlq.md`
- `09-outbox-pattern.md`
- `10-saga-workflows.md`
- `11-api-gateway-architecture.md`
- `12-observability-architecture.md`
- `13-docker-architecture.md`
- `14-migration-strategy.md`
- `15-testing-strategy.md`
- `16-security-architecture.md`
- `17-rollback-plan.md`
- `18-module-migration-map.md`
