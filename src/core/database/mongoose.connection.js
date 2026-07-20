import mongoose from 'mongoose';
import { logger } from '../logger/pino.logger.js';

class MongooseConnection {
  #connected = false;

  async connect(uri, options = {}) {
    if (this.#connected) return mongoose.connection;

    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected');
    });
    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(uri, {
      maxPoolSize: 10,
      ...options,
    });

    this.#connected = true;
    return mongoose.connection;
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
