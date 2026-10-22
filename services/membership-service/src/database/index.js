import mongoose from 'mongoose';
import { logger } from '@getready/logger';
import { config } from '../config/index.js';

export async function mongooseConnection() {
  const uri = config.mongoUri;
  if (!uri) {
    logger.warn('No MongoDB URI provided for Membership Service. Running in detached mode.');
    return null;
  }

  const options = {
    maxPoolSize: 50,
    minPoolSize: 10,
    family: 4,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  try {
    const conn = await mongoose.connect(uri, options);
    logger.info('Connected to MongoDB for Membership Service with optimized pool (max 50, min 10)');
    return conn;
  } catch (err) {
    logger.error({ err }, 'Failed to connect to MongoDB for Membership Service');
    throw err;
  }
}

export default mongooseConnection;
