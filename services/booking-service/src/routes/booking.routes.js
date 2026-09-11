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

export function createBookingRoutes(ctrl) {
  const router = Router();

  // 1. Authoritative Pre-booking Preview
  router.post('/preview', validate(bookingValidator, 'previewBooking'), ctrl.preview);

  // 2. Analytics & Operations Command Center
  router.get('/analytics/dashboard', ctrl.getDashboardAnalytics);
  router.get('/operations/live', ctrl.getLiveOperations);

  // 3. Booking Listings
  router.get('/my', ctrl.listMyBookings);
  router.get('/admin', ctrl.listAdminBookings);
  router.get('/', ctrl.listAdminBookings);
  router.get('/beautician/my-assignments', ctrl.getBeauticianAssignments);

  // 4. Admin Runtime Settings
  router.get('/admin/settings', ctrl.getSettings);
  router.put('/admin/settings', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);
  router.patch('/admin/settings', validate(bookingValidator, 'updateSettings'), ctrl.updateSettings);

  // 4. Create Booking
  router.post('/', validate(bookingValidator, 'createBooking'), ctrl.create);

  // 5. Booking Item & Details Operations
  router.get('/:id', ctrl.getById);
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
