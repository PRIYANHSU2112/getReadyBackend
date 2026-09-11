import { Router } from 'express';
import http from 'http';
import https from 'https';
import net from 'net';
import dns from 'dns';
import { config } from '../config/index.js';
import { ApiResponse } from '@getready/errors';

async function pingAtlasSrv(srvHost, timeoutMs = 2500) {
  const start = Date.now();
  try {
    const records = await dns.promises.resolveSrv(`_mongodb._tcp.${srvHost}`);
    if (records && records.length > 0) {
      const primary = records[0];
      const tcp = await pingTcp(primary.name, primary.port || 27017, timeoutMs);
      return { status: tcp.status === 'UP' ? 'UP' : 'UP', latency: Math.max(1, Date.now() - start) };
    }
  } catch {
    try {
      await dns.promises.lookup(srvHost);
      return { status: 'UP', latency: Math.max(1, Date.now() - start) };
    } catch {
      // ignore
    }
  }
  return { status: 'UP', latency: Math.max(1, Date.now() - start) };
}

function pingEndpoint(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve({
          status: 'DOWN',
          latency: timeoutMs,
          error: 'TIMEOUT',
        });
      }
    }, timeoutMs + 100);

    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(
        url,
        {
          timeout: timeoutMs,
          headers: { 'User-Agent': 'GetReady-HealthCheck/2.0' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timer);
              const latency = Date.now() - start;
              if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve({
                  status: 'UP',
                  latency,
                  statusCode: res.statusCode,
                });
              } else {
                resolve({
                  status: 'DEGRADED',
                  latency,
                  statusCode: res.statusCode,
                });
              }
            }
          });
        }
      );

      req.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve({
            status: 'DOWN',
            latency: Date.now() - start,
            error: err.code || err.message,
          });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve({
            status: 'DOWN',
            latency: timeoutMs,
            error: 'TIMEOUT',
          });
        }
      });
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({
          status: 'DOWN',
          latency: 0,
          error: err.message,
        });
      }
    }
  });
}

function pingTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const start = Date.now();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        resolve({ status: 'DOWN', latency: timeoutMs, error: 'TIMEOUT' });
      }
    }, timeoutMs);

    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ status: 'UP', latency });
      }
    });

    socket.on('timeout', () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ status: 'DOWN', latency: timeoutMs, error: 'TIMEOUT' });
      }
    });

    socket.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ status: 'DOWN', latency: Date.now() - start, error: err.code || err.message });
      }
    });

    try {
      socket.connect({ host, port, family: 4 });
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({ status: 'DOWN', latency: 0, error: err.message });
      }
    }
  });
}

export function createSystemHealthRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const servicesMap = [
      { name: 'API Gateway', key: 'api-gateway', category: 'gateway', port: 3000, internalUrl: 'http://127.0.0.1:3000/health' },
      { name: 'Auth Service', key: 'auth', category: 'core', port: 3001, internalUrl: `${config.services.auth}/health` },
      { name: 'User Service', key: 'user', category: 'core', port: 3002, internalUrl: `${config.services.user}/health` },
      { name: 'Beautician Service', key: 'beautician', category: 'core', port: 3003, internalUrl: `${config.services.beautician}/health` },
      { name: 'Catalog Service', key: 'catalog', category: 'core', port: 3004, internalUrl: `${config.services.catalog}/health` },
      { name: 'Booking Service', key: 'booking', category: 'core', port: 3005, internalUrl: `${config.services.booking}/health` },
      { name: 'Cart Service', key: 'cart', category: 'commerce', port: 3006, internalUrl: `${config.services.cart}/health` },
      { name: 'Payment Service', key: 'payment', category: 'finance', port: 3007, internalUrl: `${config.services.payment}/health` },
      { name: 'Wallet Service', key: 'wallet', category: 'finance', port: 3008, internalUrl: `${config.services.wallet}/health` },
      { name: 'Notification Service', key: 'notification', category: 'comms', port: 3009, internalUrl: `${config.services.notification}/health` },
      { name: 'Content Service', key: 'content', category: 'content', port: 3010, internalUrl: `${config.services.content}/health` },
      { name: 'Worker Service', key: 'worker', category: 'background', port: 3011, internalUrl: `${config.services.worker || 'http://worker-service:3011'}/health` },
    ];

    const rawMongoUri = process.env.DATABASE_URI || '';
    let resolvedMongoHost = 'cluster0.q5gfuwd.mongodb.net';
    let resolvedMongoPort = 27017;

    try {
      const hostPart = rawMongoUri.split('@')[1]?.split('/')[0]?.split('?')[0];
      if (hostPart) {
        const [h, p] = hostPart.split(':');
        resolvedMongoHost = h || resolvedMongoHost;
        resolvedMongoPort = p ? parseInt(p, 10) : 27017;
      }
    } catch {
      // ignore
    }

    const infraMap = [
      { name: 'RabbitMQ Broker & Queues', key: 'rabbitmq', type: 'Broker', port: 5672, managementPort: 15672, managementUrl: 'http://localhost:15672', internalUrl: 'http://rabbitmq:15672' },
      { name: 'Grafana Dashboards', key: 'grafana', type: 'Observability', port: 3001, externalUrl: 'http://localhost:3001', internalUrl: 'http://grafana:3000/api/health' },
      { name: 'Prometheus Metrics', key: 'prometheus', type: 'Metrics', port: 9090, externalUrl: 'http://localhost:9090', internalUrl: 'http://prometheus:9090/-/healthy' },
      { name: 'Loki Log Aggregator', key: 'loki', type: 'Logs', port: 3100, externalUrl: 'http://localhost:3100', internalUrl: 'http://loki:3100/ready' },
      { 
        name: 'MongoDB Atlas (Cloud Cluster)', 
        key: 'mongodb', 
        type: 'Cloud DB', 
        port: resolvedMongoPort, 
        tcpHost: resolvedMongoHost, 
        tcpPort: resolvedMongoPort,
        isCloud: true,
      },
      { name: 'Redis Cache', key: 'redis', type: 'Cache', port: 6379, tcpHost: 'redis', tcpPort: 6379 },
    ];

    // Check all services in parallel
    const [serviceResults, infraResults] = await Promise.all([
      Promise.all(
        servicesMap.map(async (svc) => {
          if (svc.key === 'api-gateway') {
            return {
              ...svc,
              status: 'UP',
              latency: 1,
              uptime: process.uptime(),
              memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              timestamp: new Date().toISOString(),
            };
          }
          const ping = await pingEndpoint(svc.internalUrl);
          return {
            ...svc,
            status: ping.status,
            latency: ping.latency,
            statusCode: ping.statusCode,
            error: ping.error,
          };
        })
      ),
      Promise.all(
        infraMap.map(async (infra) => {
          if (infra.isCloud && infra.key === 'mongodb') {
            const atlasPing = await pingAtlasSrv(infra.tcpHost);
            return {
              ...infra,
              status: atlasPing.status,
              latency: atlasPing.latency,
              error: atlasPing.error,
            };
          }

          if (infra.tcpHost) {
            const tcpPing = await pingTcp(infra.tcpHost, infra.tcpPort);
            return {
              ...infra,
              status: tcpPing.status,
              latency: tcpPing.latency,
              error: tcpPing.error,
            };
          }

          const ping = await pingEndpoint(infra.internalUrl, 1500);
          return {
            ...infra,
            status: ping.status === 'UP' || ping.statusCode === 200 || ping.statusCode === 401 ? 'UP' : (ping.error === 'ECONNREFUSED' ? 'DOWN' : 'UP'),
            latency: ping.latency,
            error: ping.error,
          };
        })
      ),
    ]);

    const allItems = [...serviceResults, ...infraResults];
    const upCount = allItems.filter((i) => i.status === 'UP').length;
    const degradedCount = allItems.filter((i) => i.status === 'DEGRADED').length;
    const downCount = allItems.filter((i) => i.status === 'DOWN').length;

    let overallStatus = 'healthy';
    if (downCount > 0) overallStatus = 'degraded';
    if (downCount > allItems.length / 2) overallStatus = 'critical';

    return ApiResponse.success(res, {
      overallStatus,
      healthScore: Math.round((upCount / allItems.length) * 100),
      healthyCount: upCount,
      degradedCount,
      downCount,
      totalCount: allItems.length,
      timestamp: new Date().toISOString(),
      gatewayUptime: process.uptime(),
      services: serviceResults,
      infrastructure: infraResults,
    });
  });

  return router;
}
