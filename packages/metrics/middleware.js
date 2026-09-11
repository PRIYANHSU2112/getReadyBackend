import { httpRequestDuration, httpRequestTotal, httpActiveRequests, register } from './metrics.js';

export function createMetricsMiddleware(serviceName = 'service') {
  return function metricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    httpActiveRequests.inc({ service: serviceName });

    res.on('finish', () => {
      httpActiveRequests.dec({ service: serviceName });
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.baseUrl || req.route?.path || req.path || 'unknown';
      const labels = {
        service: serviceName,
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };

      httpRequestDuration.observe(labels, durationSec);
      httpRequestTotal.inc(labels);
    });

    next();
  };
}

export function metricsEndpointHandler() {
  return async function metricsHandler(_req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  };
}
