process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.APP_NAME = 'getready-microservices-test';
process.env.APP_URL = 'http://localhost:3000';
process.env.DATABASE_URI = process.env.DATABASE_URI || 'mongodb+srv://techservlet876_db_user:HzOQzzmvlaajvz8O@cluster0.q5gfuwd.mongodb.net/getready_test?retryWrites=true&w=majority&appName=Cluster0';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

process.env.JWT_SECRET = 'test-jwt-secret-min-16-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.METRICS_ENABLED = 'false';
process.env.STORAGE_PROVIDER = 'local';
