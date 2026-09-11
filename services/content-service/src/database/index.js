import mongoose from 'mongoose';
import { logger } from '@getready/logger';

export async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info({ uri }, 'Content Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Content Database');
    throw error;
  }
}
