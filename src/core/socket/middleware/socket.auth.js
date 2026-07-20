import { UnauthorizedError } from '../../../common/errors/UnauthorizedError.js';

/**
 * JWT auth for Socket.IO handshake.
 * Client should send `auth: { token }` or `Authorization: Bearer <token>` header.
 * @param {import('../../../common/utils/jwt.util.js').JwtUtil} jwtUtil
 */
export function createSocketAuthMiddleware(jwtUtil) {
  return (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new UnauthorizedError('Socket authentication required'));
      }

      const payload = jwtUtil.verify(token);
      socket.user = {
        id: payload.sub || payload.id,
        role: payload.role,
        email: payload.email,
      };
      return next();
    } catch {
      return next(new UnauthorizedError('Invalid socket token'));
    }
  };
}
