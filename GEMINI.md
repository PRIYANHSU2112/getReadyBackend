PROJECT RULES — GetReady Microservices Backend (follow strictly in every response)

STRUCTURE
- Service path: services/<service-name>/ with layers:
  routes, controllers, services, repositories, models, validators, config, database
- Packages path: packages/<package-name>/ (@getready/errors, @getready/logger, @getready/tracing, @getready/metrics, @getready/config, @getready/rabbitmq, @getready/validation)
- Database per service: Each service connects to its dedicated isolated database (e.g. getready_auth, getready_user, getready_booking)
- Constructor DI across layers: Controller -> Service -> Repository -> Model
- Asynchronous communication via RabbitMQ topic exchange (`getready.domain.events`)

ASYNC / PERFORMANCE
- RabbitMQ events for cross-service asynchronous workflows with Transactional Outbox pattern
- Idempotency on all event consumers (eventId deduplication + DB unique indexes)
- Independent calls -> Promise.all (never sequential await)
- Financial/critical writes -> ACID session transactions within bounded context

DATABASE & CACHING
- Database isolation: No cross-service direct DB access or joins
- Use .lean() + DTO mappers, strip internal fields
- Distributed Redis caching and Redlock distributed locks for slot concurrency
- Case-insensitive search -> regex with escapeRegex, $options: 'i'

OBSERVABILITY & TRACING
- Structured JSON logging with Pino (@getready/logger) with PII redaction
- Distributed trace propagation via `x-correlation-id` and `x-request-id` (@getready/tracing)
- Prometheus metrics on `/metrics` endpoint with prom-client (@getready/metrics)
- Health endpoints: GET `/health` and GET `/ready` on every microservice

VALIDATION / SECURITY
- Joi validation with .unknown(false) via @getready/validation
- Zero-trust pricing in Cart Service: backend calculates all item prices and totals
- RBAC authorization with Super Admin bypass in User & Auth services