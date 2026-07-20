import { logger } from '../logger/pino.logger.js';

/**
 * OpenTelemetry tracing stub — wire SDK when OTEL_ENABLED=true.
 * @param {{ enabled: boolean, serviceName: string }} otelConfig
 */
export function initTracing(otelConfig) {
  if (!otelConfig?.enabled) {
    logger.debug('OpenTelemetry tracing disabled');
    return;
  }

  // Placeholder: install @opentelemetry/sdk-node and exporters in production.
  logger.info(
    { serviceName: otelConfig.serviceName },
    'OpenTelemetry enabled (stub — add SDK exporters as needed)',
  );
}
