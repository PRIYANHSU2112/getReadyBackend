import { Router } from 'express';
import proxy from 'express-http-proxy';
import { config } from '../config/index.js';
import { logger } from '@getready/logger';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';

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

  // 1. Auth Service (/api/v1/auth)
  router.use('/api/v1/auth', createServiceProxy(services.auth, 'auth-service'));

  // 2. User Service (/api/v1/users, addresses, members, memberships, customer-profiles, roles, permissions, referrals)
  router.use('/api/v1/users', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/addresses', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/members', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/memberships', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/customer-profiles', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/roles', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/permissions', createServiceProxy(services.user, 'user-service'));
  router.use('/api/v1/referrals', createServiceProxy(services.user, 'user-service'));

  // 3. Beautician Service (/api/v1/beautician-profiles, beauticians, bank-details, skills)
  router.use('/api/v1/beautician-profiles', createServiceProxy(services.beautician, 'beautician-service'));
  router.use('/api/v1/beauticians', createServiceProxy(services.beautician, 'beautician-service'));
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

  // 8. Wallet Service (/api/v1/wallet, wallets)
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

  return router;
}
