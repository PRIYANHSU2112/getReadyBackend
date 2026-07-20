process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.APP_NAME = 'salon-api-test';
process.env.APP_URL = 'http://localhost:3000';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salon-test';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

process.env.JWT_SECRET = 'test-jwt-secret-min-16-chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.METRICS_ENABLED = 'false';
process.env.STORAGE_PROVIDER = 'local';
