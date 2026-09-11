import http from 'http';
import { logger } from '@getready/logger';
import { config } from './config/index.js';
import { createApp } from './app.js';

let server;

async function bootstrap() {
  try {
    const app = createApp();
    server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv, service: 'api-gateway' },
        `API Gateway running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error(err, 'API Gateway startup failed');
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('API Gateway shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  logger.info('API Gateway stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
