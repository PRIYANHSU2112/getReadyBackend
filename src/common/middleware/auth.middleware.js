import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @param {import('../utils/jwt.util.js').JwtUtil} jwtUtil
 */
export function createAuthMiddleware(jwtUtil) {
  return asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = header.slice(7);
    try {
      const payload = jwtUtil.verify(token);
      req.user = {
        id: payload.sub || payload.id,
        role: payload.role,
        email: payload.email,
        phone: payload.phone,
      };
      next();
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });
}

/**
 * Optional auth — attaches user if token present, otherwise continues.
 * @param {import('../utils/jwt.util.js').JwtUtil} jwtUtil
 */
export function createOptionalAuthMiddleware(jwtUtil) {
  return asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next();
    }
    try {
      const payload = jwtUtil.verify(header.slice(7));
      req.user = {
        id: payload.sub || payload.id,
        role: payload.role,
        email: payload.email,
        phone: payload.phone,
      };
    } catch {
      // ignore invalid optional token
    }
    next();
  });
}
