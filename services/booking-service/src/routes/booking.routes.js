import { Router } from 'express';
import { validate } from '@getready/validation';
import { bookingValidator } from '../validators/booking.validation.js';

export function createSlotRoutes(ctrl) {
  const router = Router();
  router.get('/available', ctrl.listAvailable);
  router.post('/hold', validate(bookingValidator, 'holdSlot'), ctrl.hold);
  router.post('/release', validate(bookingValidator, 'releaseSlot'), ctrl.release);

  router.get('/', ctrl.listAdmin);
  router.post('/bulk', validate(bookingValidator, 'bulkCreateSlots'), ctrl.bulkCreate);
  router.post('/', validate(bookingValidator, 'createSlot'), ctrl.create);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', ctrl.update);
  router.delete('/:id', ctrl.remove);
  return router;
}

export function createCalendarRoutes(calendarCtrl) {
  const router = Router();

  // Multi-view and sub-resource Calendar APIs
  router.get('/today', calendarCtrl.getTodayAppointments);
  router.get('/summary', validate(bookingValidator, 'calendarSummaryQuery'), calendarCtrl.getSummary);
  router.get('/availability', validate(bookingValidator, 'availabilityQuery'), calendarCtrl.getAvailability);
  router.get('/conflicts', calendarCtrl.getConflicts);

  // View-specific aliases
  router.get('/month', (req, res, next) => {
    req.query.view = 'month';
    return calendarCtrl.getCalendar(req, res, next);
  });
  router.get('/week', (req, res, next) => {
    req.query.view = 'week';
    return calendarCtrl.getCalendar(req, res, next);
  });
  router.get('/day', (req, res, next) => {
    req.query.view = 'day';
    return calendarCtrl.getCalendar(req, res, next);
  });
  router.get('/agenda', (req, res, next) => {
    req.query.view = 'agenda';
    return calendarCtrl.getCalendar(req, res, next);
  });

  // Base Calendar Query API (supports view=day|week|month|agenda)
  router.get('/', validate(bookingValidator, 'calendarQuery'), calendarCtrl.getCalendar);

  return router;
}

export function createBookingRoutes(ctrl, calendarCtrl = null) {
  const router = Router();

  // 1. Calendar Nested Endpoints (for /api/v1/bookings/calendar)
  if (calendarCtrl) {
    router.get('/calendar/today', calendarCtrl.getTodayAppointments);
    router.get('/calendar/summary', validate(bookingValidator, 'calendarSummaryQuery'), calendarCtrl.getSummary);
    router.get('/calendar/availability', validate(bookingValidator, 'availabilityQuery'), calendarCtrl.getAvailability);
    router.get('/calendar/conflicts', calendarCtrl.getConflicts);
    router.get('/calendar', validate(bookingValidator, 'calendarQuery'), calendarCtrl.getCalendar);
  }

  // 2. Authoritative Pre-booking Preview
  router.post('/preview', validate(bookingValidator, 'previewBooking'), ctrl.preview);

  // 3. Analytics & Operations Command Center
  router.get('/analytics/dashboard', ctrl.getDashboardAnalytics);
  router.get('/operations/live', ctrl.getLiveOperations);

  // 4. Booking Listings
  router.get('/my', ctrl.listMyBookings);
  router.get('/admin', ctrl.listAdminBookings);
  router.get('/', ctrl.listAdminBookings);
  router.get('/beautician/my-assignments', ctrl.getBeauticianAssignments);

  // 5. Admin Runtime Settings
  router.get('/admin/settings', ctrl.getSettings);
  router.put('/admin/settings', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);
  router.patch('/admin/settings', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);

  // 6. Create Booking
  router.post('/', validate(bookingValidator, 'createBooking'), ctrl.create);

  // 7. Booking Lifecycle & Calendar Operations
  router.get('/:id', ctrl.getById);
  if (calendarCtrl) {
    router.patch('/:id/reschedule', validate(bookingValidator, 'rescheduleBooking'), calendarCtrl.reschedule);
    router.post('/:id/complete', validate(bookingValidator, 'completeBooking'), calendarCtrl.complete);
  }
  router.post('/:id/start-otp/verify', validate(bookingValidator, 'verifyOtp'), ctrl.verifyStartOtp);
  router.post('/:id/items/:itemId/complete', validate(bookingValidator, 'completeItem'), ctrl.completeServiceItem);
  router.post('/:id/end-otp/verify', validate(bookingValidator, 'verifyOtp'), ctrl.verifyEndOtp);
  router.post('/:id/cancel', validate(bookingValidator, 'cancelBooking'), ctrl.cancel);
  router.post('/:id/assign', validate(bookingValidator, 'adminAssign'), ctrl.adminAssign);

  return router;
}

export function createReportsRoutes(ctrl) {
  const router = Router();
  router.get('/', ctrl.listReports);
  return router;
}

export function createSettingsRoutes(ctrl) {
  const router = Router();
  router.get('/', ctrl.getSettings);
  router.put('/', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);
  router.patch('/', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);
  return router;
}
