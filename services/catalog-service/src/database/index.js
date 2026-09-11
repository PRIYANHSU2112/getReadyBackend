import mongoose from 'mongoose';
import { logger } from '@getready/logger';

export const mongooseConnection = {
  async connect(uri) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    logger.info({ uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Catalog Service connected to MongoDB');
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
