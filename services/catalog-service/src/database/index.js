import mongoose from 'mongoose';
import { logger } from '@getready/logger';

export const mongooseConnection = {
  async connect(uri) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '50', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '10', 10),
      family: 4,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
    });
    logger.info({ uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Catalog Service connected to MongoDB with high-concurrency connection pool');
  },
  async disconnect() {
    await mongoose.disconnect();
    logger.info('Catalog Service disconnected from MongoDB');
  },
  isReady() {
    return mongoose.connection.readyState === 1;
  },
};

export default mongooseConnection;
