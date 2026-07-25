import mongoose from 'mongoose';
import { logger } from '../logger/pino.logger.js';

const DEFAULT_RETRIES = 5;
const DEFAULT_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MongooseConnection {
  #connected = false;
  #listenersBound = false;

  #bindListeners() {
    if (this.#listenersBound) return;
    this.#listenersBound = true;

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected');
    });
    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  }

  /**
   * Connect to MongoDB with retry/backoff (helps Atlas / container startup).
   * @param {string} uri
   * @param {{ maxPoolSize?: number, retries?: number, retryDelayMs?: number }} [options]
   */
  async connect(uri, options = {}) {
    if (this.#connected) return mongoose.connection;

    const {
      retries = DEFAULT_RETRIES,
      retryDelayMs = DEFAULT_DELAY_MS,
      ...mongooseOptions
    } = options;

    mongoose.set('strictQuery', true);
    this.#bindListeners();

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await mongoose.connect(uri, {
          maxPoolSize: 10,
          ...mongooseOptions,
        });
        this.#connected = true;
        return mongoose.connection;
      } catch (err) {
        lastError = err;
        logger.warn(
          { err, attempt, retries },
          `MongoDB connect failed (attempt ${attempt}/${retries})`,
        );
        try {
          await mongoose.disconnect();
        } catch {
          // ignore cleanup between retries
        }
        if (attempt < retries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    throw lastError;
  }

  async disconnect() {
    if (!this.#connected) return;
    await mongoose.disconnect();
    this.#connected = false;
    logger.info('MongoDB disconnected cleanly');
  }

  isReady() {
    return mongoose.connection.readyState === 1;
  }

  get connection() {
    return mongoose.connection;
  }
}

export const mongooseConnection = new MongooseConnection();
export default mongooseConnection;
