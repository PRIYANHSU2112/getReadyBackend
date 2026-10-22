import { Router } from 'express';
import proxy from 'express-http-proxy';
import { config } from '../config/index.js';
import { logger } from '@getready/logger';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';

function isOriginAllowed(origin) {
  if (!origin) return false;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  const explicitAllowedOrigins = new Set([
    'https://admin.ready.deepent.in',
    'https://api.priyashu.in',
    'https://admin.getready.example.com',
    'https://www.getready.example.com',
    'https://getready-admin.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5000',
    ...(Array.isArray(config.corsOrigins)
      ? config.corsOrigins.map((o) => o.trim().replace(/\/+$/, ''))
      : []),
  ]);

  if (explicitAllowedOrigins.has(cleanOrigin)) return true;

  return (
    /^https?:\/\/([a-z0-9-]+\.)*ready\.deepent\.in$/i.test(cleanOrigin) ||
    /^https?:\/\/([a-z0-9-]+\.)*priyashu\.in$/i.test(cleanOrigin) ||
    /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(cleanOrigin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)
  );
}

function createServiceProxy(targetUrl, serviceName) {
  return proxy(targetUrl, {
    parseReqBody: false,
    proxyReqPathResolver: (req) => {
      return req.originalUrl;
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      delete proxyReqOpts.headers['expect'];
      delete proxyReqOpts.headers['connection'];
      proxyReqOpts.headers['x-correlation-id'] = srcReq.correlationId;
      proxyReqOpts.headers['x-request-id'] = srcReq.requestId;
      if (srcReq.headers['x-user-id']) proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
      if (srcReq.headers['x-user-role']) proxyReqOpts.headers['x-user-role'] = srcReq.headers['x-user-role'];
      if (srcReq.headers['x-user-email']) proxyReqOpts.headers['x-user-email'] = srcReq.headers['x-user-email'];
      if (srcReq.headers['x-user-phone']) proxyReqOpts.headers['x-user-phone'] = srcReq.headers['x-user-phone'];
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes) => {
      // Ensure authoritative CORS headers from API Gateway are attached to proxied responses
      const origin = userReq.headers['origin'];
      const allowedOrigin =
        (userRes && typeof userRes.getHeader === 'function' && userRes.getHeader('access-control-allow-origin')) ||
        (isOriginAllowed(origin) ? origin : null);

      if (allowedOrigin) {
        headers['access-control-allow-origin'] = allowedOrigin;
        headers['access-control-allow-credentials'] = 'true';
        headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
        headers['access-control-allow-headers'] =
          'Content-Type,Authorization,X-Requested-With,Accept,Origin,x-correlation-id,x-request-id,x-user-id,x-user-role,x-user-email,x-user-phone,Range';
        headers['access-control-expose-headers'] =
          'x-correlation-id,x-request-id,Content-Range,X-Total-Count,Authorization';
      } else {
        delete headers['access-control-allow-origin'];
        delete headers['access-control-allow-credentials'];
      }

      if (headers['vary']) {
        if (!headers['vary'].toLowerCase().includes('origin')) {
          headers['vary'] += ', Origin';
        }
      } else {
        headers['vary'] = 'Origin';
      }

      return headers;
    },
    proxyErrorHandler: (err, res, next) => {
      logger.error({ err, service: serviceName, targetUrl }, 'Gateway proxy error to downstream service');
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return ApiResponse.error(
          res,
          `Service unavailable: ${serviceName}`,
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCodes.SERVICE_UNAVAILABLE,
        );
      }
      if (err.code === 'ETIMEDOUT') {
        return ApiResponse.error(
          res,
          `Service timeout: ${serviceName}`,
          HttpStatus.GATEWAY_TIMEOUT,
          ErrorCodes.GATEWAY_TIMEOUT,
        );
      }
      return next(err);
    },
    timeout: 30000,
  });
}

export function createGatewayRouter(serviceOverrides = {}) {
  const router = Router();
  const services = { ...config.services, ...serviceOverrides };

  // 0. High-Performance Aggregated Home Endpoints (< 50ms Redis, < 200ms DB)
  // User Home Endpoints (Exactly 3 Concurrent Initial Calls)
  router.use('/api/v1/home/banners', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/home/feed', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/home/summary', createServiceProxy(services.booking, 'booking-service'));

  // Beautician Home Endpoints (Exactly 3 Concurrent Initial Calls + Duty Toggle)
  router.use('/api/v1/beautician/home/summary', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/beautician/home/upcoming-bookings', createServiceProxy(services.booking, 'booking-service'));
  router.use('/api/v1/beautician/home/services', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/beautician/home/duty', createServiceProxy(services.beautician, 'beautician-service'));

  // 1. Auth Service (/api/v1/auth)
  router.use('/api/v1/auth', createServiceProxy(services.auth, 'auth-service'));

  // 2. User Service (/api/v1/users, addresses, members, customer-profiles, roles, permissions, referrals)
  router.use('/api/v1/users', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/addresses', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/members', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/customer-profiles', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/roles', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/permissions', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/referrals', createServiceProxy(services.user, 'user-service'));

  // Membership Service (/api/v1/memberships, /api/v1/admin/memberships)
  router.use('/api/v1/memberships', createServiceProxy(services.membership, 'membership-service'));
  router.use('/api/v1/admin/memberships', createServiceProxy(services.membership, 'membership-service'));

  // 3. Beautician Service (/api/v1/beautician-profiles, beauticians, beautician, bank-details, skills)
  router.use('/api/v1/beautician-profiles', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/beauticians', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/beautician', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/bank-details', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/skills', createServiceProxy(services.beautician, 'beautician-service'));

  // 4. Catalog Service (/api/v1/categories, services, service-change-requests, packages, filters, hygiene-kits, coupons)
  router.use('/api/v1/categories', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/services', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/service-change-requests', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/packages', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/filters', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/hygiene-kits', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/coupons', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/offers', createServiceProxy(services.catalog, 'catalog-service'));
  router.use('/api/v1/admin/promotions', createServiceProxy(services.catalog, 'catalog-service'));

  // 5. Booking & Calendar Service (/api/v1/slots, bookings, calendar, reports, settings)
  router.use('/api/v1/slots', createServiceProxy(services.booking, 'booking-service'));
  router.use('/api/v1/calendar', createServiceProxy(services.booking, 'booking-service'));
  router.use('/api/v1/bookings', createServiceProxy(services.booking, 'booking-service'));
  router.use('/admin/calendar', createServiceProxy(services.booking, 'booking-service'));
  router.use('/admin/bookings', createServiceProxy(services.booking, 'booking-service'));
  router.use('/api/v1/reports', createServiceProxy(services.booking, 'booking-service'));
  router.use('/api/v1/settings', createServiceProxy(services.booking, 'booking-service'));

  // 6. Cart Service (/api/v1/cart)
  router.use('/api/v1/cart', createServiceProxy(services.cart, 'cart-service'));

  // 7. Payment Service (/api/v1/payments, finance)
  router.use('/api/v1/payments', createServiceProxy(services.payment, 'payment-service'));
  router.use('/api/v1/finance', createServiceProxy(services.payment, 'payment-service'));

  // 8. Wallet Service (/api/v1/wallet, wallets, beautician/wallet, admin/payouts)
  router.use('/api/v1/beautician/wallet', createServiceProxy(services.wallet, 'wallet-service'));
  router.use('/api/v1/admin/payouts', createServiceProxy(services.wallet, 'wallet-service'));
  router.use('/api/v1/wallet', createServiceProxy(services.wallet, 'wallet-service'));
  router.use('/api/v1/wallets', createServiceProxy(services.wallet, 'wallet-service'));

  // 9. Notification Service (/api/v1/notifications)
  router.use('/api/v1/notifications', createServiceProxy(services.notification, 'notification-service'));

  // 10. Content Service (/api/v1/banners, marketing, blogs, support, tickets, reviews, cms, content)
  router.use('/api/v1/banners', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/marketing', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/blogs', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/support', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/tickets', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/reviews', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/cms', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/content', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/landing', createServiceProxy(services.content, 'content-service'));
  router.use('/api/v1/faq', createServiceProxy(services.content, 'content-service'));

  // 11. Search Service (/api/v1/search)
  router.use('/api/v1/search', createServiceProxy(services.search, 'search-service'));

  return router;
}
