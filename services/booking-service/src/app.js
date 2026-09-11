import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, metricsEndpointHandler } from '@getready/metrics';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';
import { config } from './config/index.js';
import { mongooseConnection } from './database/index.js';

import {
  SlotRepository,
  BookingRepository,
  BookingOutboxRepository,
} from './repositories/booking.repositories.js';

import { SlotInventory } from './inventory/slot.inventory.js';
import { SlotService } from './services/slot.service.js';
import { BookingService } from './services/booking.service.js';
import { CalendarService } from './services/calendar.service.js';

import {
  SlotController,
  BookingController,
} from './controllers/booking.controllers.js';
import { CalendarController } from './controllers/calendar.controller.js';

import {
  createSlotRoutes,
  createBookingRoutes,
  createCalendarRoutes,
  createReportsRoutes,
  createSettingsRoutes,
} from './routes/booking.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('booking-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Readiness
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'booking-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    if (!mongooseConnection.isReady()) {
      return ApiResponse.error(res, 'Database not ready', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return ApiResponse.success(res, { status: 'ready', service: 'booking-service' });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // DI Wiring
  const slotRepo = deps.slotRepository || new SlotRepository();
  const bookingRepo = deps.bookingRepository || new BookingRepository();
  const outboxRepo = deps.outboxRepository || new BookingOutboxRepository();
  const slotInventory = deps.slotInventory || new SlotInventory(config);

  const slotService = deps.slotService || new SlotService(slotRepo, slotInventory, deps.eventPublisher || null);
  const bookingService =
    deps.bookingService ||
    new BookingService(bookingRepo, slotRepo, outboxRepo, slotInventory, deps.eventPublisher || null);
  const calendarService =
    deps.calendarService ||
    new CalendarService(bookingRepo, slotRepo, deps.eventPublisher || null);

  const slotCtrl = new SlotController(slotService);
  const bookingCtrl = new BookingController(bookingService);
  const calendarCtrl = new CalendarController(calendarService);

  // Mount routes
  const calendarRouter = createCalendarRoutes(calendarCtrl);
  const bookingRouter = createBookingRoutes(bookingCtrl, calendarCtrl);

  app.use('/api/v1/slots', createSlotRoutes(slotCtrl));
  app.use('/api/v1/calendar', calendarRouter);
  app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/reports', createReportsRoutes(bookingCtrl));
  app.use('/api/v1/settings', createSettingsRoutes(bookingCtrl));

  // Admin route aliases for direct matching
  app.use('/admin/calendar', calendarRouter);
  app.use('/admin/bookings', bookingRouter);

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Booking Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return { app, bookingService, calendarService };
}

export default createApp;
