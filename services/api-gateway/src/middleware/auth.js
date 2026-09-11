import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Optional token decoder at the Gateway layer:
 * Extracts JWT claims and injects them as trusted downstream headers:
 * - x-user-id
 * - x-user-role
 * - x-user-email
 * - x-user-phone
 */
export function gatewayIdentityMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.headers['x-user-id'] = decoded.sub || decoded.id || '';
      req.headers['x-user-role'] = decoded.role || '';
      req.headers['x-user-email'] = decoded.email || '';
      req.headers['x-user-phone'] = decoded.phone || '';
      req.user = {
        id: decoded.sub || decoded.id,
        role: decoded.role,
        email: decoded.email,
        phone: decoded.phone,
      };
    } catch {
      // Allow downstream services or route guards to handle invalid token rejection
    }
  }
  next();
}
