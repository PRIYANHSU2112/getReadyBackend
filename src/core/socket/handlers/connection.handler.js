import { logger } from '../../logger/pino.logger.js';

/**
 * @param {import('socket.io').Server} io
 * @param {{ roomManager: import('../rooms/room.manager.js').RoomManager, presenceManager: import('../presence/presence.manager.js').PresenceManager }} deps
 */
export function registerConnectionHandlers(io, deps) {
  const { roomManager, presenceManager } = deps;

  io.on('connection', async (socket) => {
    const userId = socket.user?.id;
    logger.info({ socketId: socket.id, userId }, 'Socket connected');

    if (userId) {
      await presenceManager.setOnline(userId, socket.id);
      socket.join(`user:${userId}`);
    }

    socket.on('room:join', async (roomId, ack) => {
      try {
        await roomManager.join(socket, roomId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('room:leave', async (roomId, ack) => {
      try {
        await roomManager.leave(socket, roomId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Socket disconnected');
      if (userId) {
        await presenceManager.setOffline(userId, socket.id);
      }
    });
  });
}
