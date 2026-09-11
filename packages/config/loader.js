import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

// Ensure IPv4 lookup precedence in containers to avoid IPv6 unreachable errors
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // ignore
}

/**
 * Recursively searches for environment files starting from `startDir` upwards to root.
 */
function findEnvFile(fileName, startDir = process.cwd(), maxLevels = 5) {
  let currentDir = startDir;
  for (let i = 0; i < maxLevels; i++) {
    const candidate = path.join(currentDir, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return null;
}

/**
 * Initializes dotenv by loading environment-specific configuration files
 * in predictable priority order without accidentally mixing dev/prod values.
 */
export function initEnvironment() {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();

  // 1. Environment-specific override (e.g. .env.development.local or .env.production.local)
  const envLocalFile = findEnvFile(`.env.${nodeEnv}.local`);
  if (envLocalFile) {
    dotenv.config({ path: envLocalFile });
  }

  // 2. Generic local override (.env.local)
  const localFile = findEnvFile('.env.local');
  if (localFile) {
    dotenv.config({ path: localFile });
  }

  // 3. Environment-specific file (.env.development or .env.production)
  const envFile = findEnvFile(`.env.${nodeEnv}`);
  if (envFile) {
    dotenv.config({ path: envFile });
  }

  // 4. Base root file (.env)
  const rootEnvFile = findEnvFile('.env');
  if (rootEnvFile) {
    dotenv.config({ path: rootEnvFile });
  }
}

// Automatically initialize environment on module import
initEnvironment();

/**
 * Strict Environment Validator and Safety Guard.
 * Fails fast on misconfigurations or dangerous environment mixing.
 */
export function validateEnvironment(config) {
  const { nodeEnv, isProduction, mongoUri, jwt, corsOrigins, serviceName } = config;

  if (!mongoUri) {
    throw new Error(`[CONFIGURATION ERROR for ${serviceName}]: DATABASE_URI environment variable is required.`);
  }

  if (isProduction) {
    const issues = [];

    // 1. Database Safety
    const lowerUri = mongoUri.toLowerCase();
    if (
      lowerUri.includes('localhost') ||
      lowerUri.includes('127.0.0.1') ||
      lowerUri.includes('getready_dev') ||
      lowerUri.includes('/test')
    ) {
      issues.push(
        `Production DATABASE_URI cannot point to local/development databases (found: "${mongoUri}").`,
      );
    }

    // 2. JWT Security
    const insecureSecrets = [
      'change-me',
      'super_secret',
      'development',
      'secret123',
      'default',
      'secret',
    ];
    if (!jwt.secret || jwt.secret.length < 32) {
      issues.push('JWT_SECRET in production must be at least 32 characters long.');
    } else if (insecureSecrets.some((s) => jwt.secret.toLowerCase().includes(s))) {
      issues.push('JWT_SECRET contains an insecure development/placeholder secret.');
    }

    // 3. CORS Security
    if (corsOrigins.includes('*')) {
      issues.push('CORS_ORIGINS cannot be wildcard (*) in production with credentials enabled.');
    }

    if (issues.length > 0) {
      const errorMessage = `[PRODUCTION ENVIRONMENT VALIDATION FAILED for ${serviceName}]:\n  - ${issues.join('\n  - ')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  } else {
    // Development Warnings
    if (mongoUri && (mongoUri.includes('getready_prod') || mongoUri.includes('production_cluster'))) {
      console.warn(
        `[WARNING] NODE_ENV is "development", but DATABASE_URI appears to contain production references: "${mongoUri}".`,
      );
    }
  }
}

/**
 * Resolves internal microservice URLs when running inside Docker containers.
 */
function resolveServiceUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const isInsideDocker =
    fs.existsSync('/.dockerenv') ||
    process.env.IS_DOCKER === 'true' ||
    process.env.DOCKER_CONTAINER === 'true' ||
    Boolean(process.env.AUTH_SERVICE_URL && process.env.AUTH_SERVICE_URL.includes('auth-service'));

  if (!isInsideDocker) return rawUrl;

  const portToService = {
    '3001': 'auth-service:3001',
    '3002': 'user-service:3002',
    '3003': 'beautician-service:3003',
    '3004': 'catalog-service:3004',
    '3005': 'booking-service:3005',
    '3006': 'cart-service:3006',
    '3007': 'payment-service:3007',
    '3008': 'wallet-service:3008',
    '3009': 'notification-service:3009',
    '3010': 'content-service:3010',
    '3011': 'worker-service:3011',
  };

  let resolved = rawUrl;
  for (const [port, serviceHost] of Object.entries(portToService)) {
    resolved = resolved
      .replace(`localhost:${port}`, serviceHost)
      .replace(`127.0.0.1:${port}`, serviceHost);
  }
  return resolved;
}

/**
 * Loads service configuration with environment awareness, sensible defaults, and safety validation.
 */
export function loadServiceConfig(serviceName = 'service', defaults = {}) {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const port = parseInt(process.env.PORT || defaults.port || '3000', 10);
  const appName = process.env.APP_NAME || `getready-${serviceName}`;
  const appUrl = process.env.APP_URL || (isProduction ? `https://${serviceName}.getready.example.com` : `http://localhost:${port}`);

  // Database URI: STRICTLY process.env.DATABASE_URI only
  const mongoUri = (process.env.DATABASE_URI || defaults.mongoUri || defaults.database?.uri || '').trim();

  // RabbitMQ
  const rabbitmqUrl =
    process.env.RABBITMQ_URL ||
    process.env.AMQP_URL ||
    defaults.rabbitmqUrl ||
    'amqp://guest:guest@localhost:5672';

  // Redis
  const redisEnabled = process.env.REDIS_ENABLED === 'true' || defaults.redisEnabled === true;
  const redisHost = process.env.REDIS_HOST || (isProduction ? 'redis' : '127.0.0.1');
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  // JWT Security
  const jwtSecret =
    process.env.JWT_SECRET ||
    (isProduction ? '' : 'getready_dev_super_secret_jwt_key_2026_at_least_32_characters');
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
  const jwtRefreshSecret =
    process.env.JWT_REFRESH_SECRET ||
    (isProduction ? '' : 'getready_dev_super_secret_jwt_refresh_key_2026_at_least_32');
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : isProduction
      ? ['https://admin.getready.example.com', 'https://www.getready.example.com']
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'];

  // Logging, Swagger & Observability
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== undefined
    ? process.env.SWAGGER_ENABLED === 'true'
    : !isProduction;

  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
  const metricsEnabled = process.env.METRICS_ENABLED !== 'false';
  const otelEnabled = process.env.OTEL_ENABLED === 'true';

  // Storage (DigitalOcean Spaces / Linode / AWS S3)
  const storageBucket =
    process.env.LINODE_OBJECT_BUCKET ||
    process.env.AWS_BUCKET_NAME ||
    (isProduction ? 'satyakabir-bucket' : 'satyakabir-bucket');
  const storageRegion =
    process.env.LINODE_OBJECT_STORAGE_REGION || process.env.AWS_REGION || 'sgp1';
  const storageEndpoint =
    process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
    process.env.AWS_ENDPOINT ||
    'https://sgp1.digitaloceanspaces.com';
  const storageAccessKeyId =
    process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
  const storageSecretAccessKey =
    process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
  const storagePrefix = process.env.BUCKET_FOLDER_PATH || (isProduction ? 'production/' : 'dev/');

  // SMS & Payments
  const smsProvider = process.env.SMS_PROVIDER || (isProduction ? 'twilio' : 'console');
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || (isProduction ? '' : 'rzp_test_SwGnzVleE55oE8');
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || (isProduction ? '' : 'wg33MCoTYvfPf28NHg5uK6Qi');

  const config = {
    nodeEnv,
    isProduction,
    isTest,
    serviceName,
    port,
    appName,
    appUrl,
    mongoUri,
    rabbitmqUrl,
    swaggerEnabled,
    redis: {
      enabled: redisEnabled,
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    },
    jwt: {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
      refreshSecret: jwtRefreshSecret,
      refreshExpiresIn: jwtRefreshExpiresIn,
    },
    corsOrigins,
    logLevel,
    metricsEnabled,
    otelEnabled,
    storage: {
      bucket: storageBucket,
      region: storageRegion,
      endpoint: storageEndpoint,
      accessKeyId: storageAccessKeyId,
      secretAccessKey: storageSecretAccessKey,
      prefix: storagePrefix,
    },
    sms: {
      provider: smsProvider,
    },
    payment: {
      keyId: razorpayKeyId,
      keySecret: razorpayKeySecret,
    },
    ...defaults,
  };

  config.mongoUri = mongoUri;
  config.database = {
    ...(defaults.database || {}),
    uri: mongoUri,
  };

  // Automatically resolve inter-service communication URLs for Docker / local networking
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && (key.endsWith('Url') || key.endsWith('URL') || key.endsWith('ServiceUrl'))) {
      config[key] = resolveServiceUrl(value);
    }
  }

  // Perform safety check only when not running unit tests in memory
  if (!isTest) {
    validateEnvironment(config);
  }

  return config;
}

export default loadServiceConfig;
