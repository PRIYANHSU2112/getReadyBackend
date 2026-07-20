import { EventEmitter } from 'events';
import { logger } from '../logger/pino.logger.js';

/**
 * In-process event bus for cross-module communication.
 * Modules must not import each other's internals — use events + DI instead.
 */
export class EventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  on(eventName, handler) {
    this.emitter.on(eventName, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error({ err, eventName }, 'Event handler failed');
      }
    });
  }

  once(eventName, handler) {
    this.emitter.once(eventName, handler);
  }

  emit(eventName, payload) {
    logger.debug({ eventName }, 'Event emitted');
    this.emitter.emit(eventName, payload);
  }

  off(eventName, handler) {
    this.emitter.off(eventName, handler);
  }

  removeAllListeners(eventName) {
    this.emitter.removeAllListeners(eventName);
  }
}

export const eventTypes = Object.freeze({
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
});
