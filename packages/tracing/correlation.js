import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

const traceStorage = new AsyncLocalStorage();

export const CORRELATION_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

export function generateCorrelationId() {
  return uuidv4();
}

export function generateRequestId() {
  return uuidv4();
}

/**
 * Express middleware to ensure Correlation ID and Request ID exist and are preserved.
 */
export function correlationMiddleware(req, res, next) {
  const correlationId =
    req.headers[CORRELATION_HEADER] ||
    req.headers[CORRELATION_HEADER.toLowerCase()] ||
    uuidv4();

  const requestId =
    req.headers[REQUEST_ID_HEADER] ||
    req.headers[REQUEST_ID_HEADER.toLowerCase()] ||
    uuidv4();

  req.correlationId = correlationId;
  req.requestId = requestId;

  res.setHeader(CORRELATION_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const context = {
    correlationId,
    requestId,
    userId: req.user?.id || null,
  };

  traceStorage.run(context, () => {
    next();
  });
}

/**
 * Get current trace context (correlationId, requestId, userId) from AsyncLocalStorage.
 */
export function getTraceContext() {
  return traceStorage.getStore() || {
    correlationId: uuidv4(),
    requestId: uuidv4(),
  };
}

/**
 * Execute a callback within an explicit trace context (used in RabbitMQ consumers).
 */
export function runWithTraceContext(context, callback) {
  return traceStorage.run(
    {
      correlationId: context.correlationId || uuidv4(),
      requestId: context.requestId || uuidv4(),
      userId: context.userId || null,
      ...context,
    },
    callback,
  );
}

/**
 * Build headers object for outgoing HTTP / fetch requests with correlation ID.
 */
export function getPropagationHeaders(extraHeaders = {}) {
  const ctx = getTraceContext();
  return {
    [CORRELATION_HEADER]: ctx.correlationId,
    [REQUEST_ID_HEADER]: ctx.requestId,
    ...extraHeaders,
  };
}
