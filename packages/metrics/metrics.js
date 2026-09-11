import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// --- HTTP Metrics ---
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['service', 'method', 'route', 'status_code'],
  registers: [register],
});

export const httpActiveRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of currently active HTTP requests',
  labelNames: ['service'],
  registers: [register],
});

// --- RabbitMQ Metrics ---
export const rabbitmqPublishedTotal = new client.Counter({
  name: 'rabbitmq_messages_published_total',
  help: 'Total number of messages published to RabbitMQ',
  labelNames: ['service', 'exchange', 'routing_key', 'status', 'event_type'],
  registers: [register],
});

export const rabbitmqConsumedTotal = new client.Counter({
  name: 'rabbitmq_messages_consumed_total',
  help: 'Total number of messages consumed from RabbitMQ',
  labelNames: ['service', 'queue', 'event_type', 'status'],
  registers: [register],
});

export const rabbitmqConsumerErrorsTotal = new client.Counter({
  name: 'rabbitmq_consumer_errors_total',
  help: 'Total number of errors encountered by consumers',
  labelNames: ['service', 'queue', 'error_type'],
  registers: [register],
});

export const rabbitmqRetryCountTotal = new client.Counter({
  name: 'rabbitmq_retry_count_total',
  help: 'Total number of retry attempts',
  labelNames: ['service', 'queue', 'retry_level'],
  registers: [register],
});

export const rabbitmqDlqMessagesTotal = new client.Counter({
  name: 'rabbitmq_dlq_messages_total',
  help: 'Total number of messages routed to Dead Letter Queue',
  labelNames: ['service', 'queue'],
  registers: [register],
});

// --- Database Metrics ---
export const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['service', 'operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

export const databaseConnectionsActive = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['service'],
  registers: [register],
});

// --- Business Metrics ---
export const bookingsCreatedTotal = new client.Counter({
  name: 'bookings_created_total',
  help: 'Total number of bookings created',
  labelNames: ['service', 'status'],
  registers: [register],
});

export const bookingsConfirmedTotal = new client.Counter({
  name: 'bookings_confirmed_total',
  help: 'Total number of bookings confirmed',
  labelNames: ['service'],
  registers: [register],
});

export const bookingsCancelledTotal = new client.Counter({
  name: 'bookings_cancelled_total',
  help: 'Total number of bookings cancelled',
  labelNames: ['service', 'reason'],
  registers: [register],
});

export const paymentsSuccessTotal = new client.Counter({
  name: 'payments_success_total',
  help: 'Total number of successful payments',
  labelNames: ['service', 'method', 'gateway', 'currency'],
  registers: [register],
});

export const paymentsFailedTotal = new client.Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payments',
  labelNames: ['service', 'method', 'gateway', 'reason'],
  registers: [register],
});

export const walletCreditsTotal = new client.Counter({
  name: 'wallet_credits_total',
  help: 'Total number of wallet credit operations',
  labelNames: ['service', 'category'],
  registers: [register],
});

export const walletDebitsTotal = new client.Counter({
  name: 'wallet_debits_total',
  help: 'Total number of wallet debit operations',
  labelNames: ['service', 'category'],
  registers: [register],
});

export const notificationsSentTotal = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['service', 'channel', 'status'],
  registers: [register],
});

export const notificationsFailedTotal = new client.Counter({
  name: 'notifications_failed_total',
  help: 'Total number of failed notifications',
  labelNames: ['service', 'channel'],
  registers: [register],
});

export { client };
