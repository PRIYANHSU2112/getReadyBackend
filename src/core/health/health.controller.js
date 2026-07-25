import { ApiResponse } from '../../common/utils/ApiResponse.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import config from '../config/index.js';
import { mongooseConnection } from '../database/index.js';
import { RedisClient } from '../redis/RedisClient.js';

export class HealthController {
  /**
   * Liveness — process is up.
   */
  health(_req, res) {
    return ApiResponse.success(res, { status: 'ok' });
  }

  /**
   * Readiness — dependencies available.
   */
  async ready(_req, res) {
    const mongoOk = mongooseConnection.isReady();
    let redisOk = !config.redis.enabled;

    if (config.redis.enabled) {
      try {
        redisOk = await RedisClient.getInstance().ping();
      } catch {
        redisOk = false;
      }
    }

    const ready = mongoOk && redisOk;
    const statusCode = ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      success: ready,
      data: {
        status: ready ? 'ready' : 'not_ready',
        checks: {
          mongodb: mongoOk ? 'up' : 'down',
          redis: config.redis.enabled ? (redisOk ? 'up' : 'down') : 'disabled',
        },
      },
    });
  }
}

export const healthController = new HealthController();
