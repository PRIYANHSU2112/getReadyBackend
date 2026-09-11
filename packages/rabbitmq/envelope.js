import { v4 as uuidv4 } from 'uuid';
import { getTraceContext } from '@getready/tracing';

/**
 * Creates a standard event envelope for all domain events.
 *
 * @param {object} params
 * @param {string} params.eventType - e.g. "BookingCreated"
 * @param {object} params.data - The event payload
 * @param {string} params.producer - Service name, e.g. "booking-service"
 * @param {string} [params.aggregateId] - Aggregate root ID
 * @param {string} [params.correlationId] - Distributed correlation ID
 * @param {string} [params.causationId] - Causation ID (e.g. triggering event/request)
 * @param {number} [params.eventVersion=1] - Schema version
 */
export function createEventEnvelope({
  eventType,
  data,
  producer,
  aggregateId = null,
  correlationId = null,
  causationId = null,
  eventVersion = 1,
}) {
  if (!eventType) throw new Error('eventType is required in event envelope');
  if (!producer) throw new Error('producer is required in event envelope');

  const traceContext = getTraceContext();
  const effectiveCorrelationId = correlationId || traceContext.correlationId || uuidv4();
  const effectiveCausationId = causationId || traceContext.requestId || effectiveCorrelationId;

  return {
    eventId: uuidv4(),
    eventType,
    eventVersion,
    occurredAt: new Date().toISOString(),
    producer,
    correlationId: effectiveCorrelationId,
    causationId: effectiveCausationId,
    aggregateId: aggregateId ? String(aggregateId) : null,
    data: data || {},
  };
}

/**
 * Validates whether a message satisfies the standard event envelope format.
 */
export function isValidEnvelope(obj) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.eventId === 'string' &&
    typeof obj.eventType === 'string' &&
    typeof obj.eventVersion === 'number' &&
    typeof obj.occurredAt === 'string' &&
    typeof obj.producer === 'string' &&
    typeof obj.data === 'object'
  );
}
