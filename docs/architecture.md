# GetReady Microservices Architecture

## Overview

The GetReady backend is a production-grade, distributed **Microservices Architecture** operating on domain-driven design principles.

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
│   ├── api-gateway/            # Port 3000 / 8080
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

## Detailed Architecture Documentation

For complete technical specifications, see:
- [01 - Current Architecture](file:///e:/GR/Backend/docs/architecture/01-current-architecture.md)
- [02 - Target Architecture](file:///e:/GR/Backend/docs/architecture/02-target-architecture.md)
- [03 - Service Boundaries](file:///e:/GR/Backend/docs/architecture/03-service-boundaries.md)
- [04 - Service Dependencies](file:///e:/GR/Backend/docs/architecture/04-service-dependencies.md)
- [05 - Database Ownership Matrix](file:///e:/GR/Backend/docs/architecture/05-database-ownership-matrix.md)
- [06 - RabbitMQ Architecture](file:///e:/GR/Backend/docs/architecture/06-rabbitmq-architecture.md)
- [07 - RabbitMQ Event Catalog](file:///e:/GR/Backend/docs/architecture/07-rabbitmq-event-catalog.md)
- [08 - RabbitMQ Retry & DLQ](file:///e:/GR/Backend/docs/architecture/08-rabbitmq-retry-dlq.md)
- [09 - Outbox Pattern](file:///e:/GR/Backend/docs/architecture/09-outbox-pattern.md)
- [10 - Saga Workflows](file:///e:/GR/Backend/docs/architecture/10-saga-workflows.md)
- [11 - API Gateway Architecture](file:///e:/GR/Backend/docs/architecture/11-api-gateway-architecture.md)
- [12 - Observability Architecture](file:///e:/GR/Backend/docs/architecture/12-observability-architecture.md)
- [13 - Docker Architecture](file:///e:/GR/Backend/docs/architecture/13-docker-architecture.md)
- [14 - Migration & Zero-Downtime Strategy](file:///e:/GR/Backend/docs/architecture/14-migration-strategy.md)
- [15 - Testing Strategy](file:///e:/GR/Backend/docs/architecture/15-testing-strategy.md)
- [16 - Security Architecture](file:///e:/GR/Backend/docs/architecture/16-security-architecture.md)
- [17 - Rollback & Disaster Recovery Plan](file:///e:/GR/Backend/docs/architecture/17-rollback-plan.md)
- [18 - Legacy Module Migration Map](file:///e:/GR/Backend/docs/architecture/18-module-migration-map.md)
