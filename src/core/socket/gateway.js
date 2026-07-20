import Redis from 'ioredis';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import config from '../config/index.js';
import { logger } from '../logger/pino.logger.js';
import { createSocketAuthMiddleware } from './middleware/socket.auth.js';
import { registerConnectionHandlers } from './handlers/connection.handler.js';
import { RoomManager } from './rooms/room.manager.js';
import { PresenceManager } from './presence/presence.manager.js';

/**
 * Socket.IO gateway — attaches to HTTP server with Redis adapter.
 */
export class SocketGateway {
  /** @type {import('socket.io').Server|null} */
  io = null;

  /**
   * @param {import('http').Server} httpServer
   * @param {object} options
   * @param {string[]} options.corsOrigins
   * @param {import('../../../common/utils/jwt.util.js').JwtUtil} options.jwtUtil
   * @param {import('ioredis').Redis} options.redisClient
   */
  async init(httpServer, options) {
    const { corsOrigins, jwtUtil, redisClient } = options;

    this.io = new Server(httpServer, {
      cors: { origin: corsOrigins, credentials: true },
      transports: ['websocket', 'polling'],
    });

    try {
      const pubClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        keepAlive: 10000,
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 5000);
        },
        password: config.redis.password,
        maxRetriesPerRequest: null,
      });
      const subClient = pubClient.duplicate();
      this.io.adapter(createAdapter(pubClient, subClient));
      this._pubClient = pubClient;
      this._subClient = subClient;
      logger.info('Socket.IO Redis adapter attached');
    } catch (err) {
      logger.warn({ err }, 'Socket.IO Redis adapter unavailable — running without adapter');
    }

    this.roomManager = new RoomManager(this.io);
    this.presenceManager = new PresenceManager(redisClient);

    this.io.use(createSocketAuthMiddleware(jwtUtil));
    registerConnectionHandlers(this.io, {
      roomManager: this.roomManager,
      presenceManager: this.presenceManager,
    });

    return this.io;
  }

  getIO() {
    return this.io;
  }

  async close() {
    if (this.io) {
      await new Promise((resolve) => this.io.close(() => resolve()));
      this.io = null;
    }
    if (this._pubClient) await this._pubClient.quit().catch(() => {});
    if (this._subClient) await this._subClient.quit().catch(() => {});
  }
}

export const socketGateway = new SocketGateway();
