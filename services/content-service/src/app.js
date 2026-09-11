import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, register } from '@getready/metrics';
import { AppError, HttpStatus } from '@getready/errors';
import { BannerRepository } from './repositories/banner.repository.js';
import { BannerService } from './services/banner.service.js';
import { BannerController } from './controllers/banner.controller.js';
import { createBannerRoutes } from './routes/banner.routes.js';
import { BlogRepository } from './repositories/blog.repository.js';
import { BlogService } from './services/blog.service.js';
import { BlogController } from './controllers/blog.controller.js';
import { createBlogRoutes } from './routes/blog.routes.js';

import { TicketRepository } from './repositories/ticket.repository.js';
import { SupportService } from './services/support.service.js';
import { SupportController } from './controllers/support.controller.js';
import { createSupportRoutes } from './routes/support.routes.js';
import { ReviewRepository } from './repositories/review.repository.js';
import { ReviewService } from './services/review.service.js';
import { ReviewController } from './controllers/review.controller.js';
import { createReviewRoutes } from './routes/review.routes.js';
import { CmsRepository } from './repositories/cms.repository.js';
import { CmsService } from './services/cms.service.js';
import { CmsController } from './controllers/cms.controller.js';
import { createCmsRoutes } from './routes/cms.routes.js';
import { LandingRepository, FaqRepository } from './repositories/landing.repository.js';
import { LandingService } from './services/landing.service.js';
import { LandingController } from './controllers/landing.controller.js';
import { createLandingRoutes, createFaqRoutes } from './routes/landing.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('content-service'));

  // User identity header propagation middleware
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'] || 'USER';
    if (userId) {
      req.user = { id: userId, _id: userId, role: userRole };
    }
    next();
  });

  // Health / Readiness / Metrics
  app.get('/health', (req, res) => {
    res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString(), service: 'content-service' });
  });

  app.get('/ready', (req, res) => {
    const isDbConnected = req.app.locals.dbConnected;
    if (isDbConnected) {
      res.status(HttpStatus.OK).json({ status: 'READY', dependencies: { database: 'UP' } });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'NOT_READY', dependencies: { database: 'DOWN' } });
    }
  });

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).end(err);
    }
  });

  // Wiring dependencies
  const bannerRepository = new BannerRepository();
  const bannerService = new BannerService(bannerRepository);
  const bannerController = new BannerController(bannerService);

  const blogRepository = new BlogRepository();
  const blogService = new BlogService(blogRepository);
  const blogController = new BlogController(blogService);

  const ticketRepository = new TicketRepository();
  const supportService = new SupportService(ticketRepository);
  const supportController = new SupportController(supportService);

  const reviewRepository = new ReviewRepository();
  const reviewService = new ReviewService(reviewRepository);
  const reviewController = new ReviewController(reviewService);

  const cmsRepository = new CmsRepository();
  const cmsService = new CmsService(cmsRepository);
  const cmsController = new CmsController(cmsService);

  const landingRepository = new LandingRepository();
  const faqRepository = new FaqRepository();
  const landingService = new LandingService(landingRepository, faqRepository);
  const landingController = new LandingController(landingService);

  // Mount routes
  const bannerRoutes = createBannerRoutes(bannerController);
  const blogRoutes = createBlogRoutes(blogController);
  const supportRoutes = createSupportRoutes(supportController);
  const reviewRoutes = createReviewRoutes(reviewController);
  const cmsRoutes = createCmsRoutes(cmsController);
  const landingRoutes = createLandingRoutes(landingController);
  const faqRoutes = createFaqRoutes(landingController);

  app.use('/api/v1/banners', bannerRoutes);
  app.use('/api/v1/marketing', bannerRoutes);
  app.use('/api/v1/content/banners', bannerRoutes);

  app.use('/api/v1/blogs', blogRoutes);
  app.use('/api/v1/content/blogs', blogRoutes);

  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/tickets', supportRoutes);
  app.use('/api/v1/content/support', supportRoutes);

  app.use('/api/v1/reviews', reviewRoutes);
  app.use('/api/v1/content/reviews', reviewRoutes);

  app.use('/api/v1/cms', cmsRoutes);
  app.use('/api/v1/content/landing', landingRoutes);
  app.use('/api/v1/landing', landingRoutes);
  app.use('/api/v1/faq', faqRoutes);
  app.use('/api/v1/content/faq', faqRoutes);
  app.use('/api/v1/content', cmsRoutes);

  // Error Handler
  app.use((err, req, res, next) => {
    logger.error({ err, path: req.path }, 'Error handling request');
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId: req.headers['x-request-id'] || req.id,
        },
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: req.headers['x-request-id'] || req.id,
      },
    });
  });

  return app;
}
