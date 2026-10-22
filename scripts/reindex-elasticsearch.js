import mongoose from 'mongoose';
import { logger } from '@getready/logger';
import { config } from '../services/search-service/src/config/index.js';
import { indexerService } from '../services/search-service/src/services/indexer.service.js';

async function run() {
  console.log('🔄 Starting Elasticsearch Initial / Full Reindex CLI...');
  const mongoUri = config.mongoUri || process.env.DATABASE_URI || 'mongodb://localhost:27017/getready_dev';

  try {
    await mongoose.connect(mongoUri);
    console.log('  Connected to MongoDB');

    const result = await indexerService.reindexFromMongo(mongoose.connection.db);
    console.log('  Reindex result:', result);

    await mongoose.disconnect();
    console.log('✨ Reindex CLI finished successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Reindex CLI failed:', err);
    process.exit(1);
  }
}

run();
