/**
 * Sets X-Response-Time header on every response.
 */
export function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const originalEnd = res.end.bind(res);

  res.end = (...args) => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs.toFixed(1)}ms`);
    }
    return originalEnd(...args);
  };

  next();
}
