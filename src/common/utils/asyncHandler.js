/**
 * Wraps async route handlers so rejected promises reach the global error middleware.
 * @param {(req, res, next) => Promise<unknown>} fn
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
