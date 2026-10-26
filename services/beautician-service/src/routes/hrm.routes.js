import { Router } from 'express';
import multer from 'multer';
import { validate } from '@getready/validation';
import { hrmValidator } from '../validators/hrm.validation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export function createHrmRoutes(ctrl) {
  const router = Router();

  // 1. Attendance Routes
  router.post('/attendance/punch-in', ctrl.punchIn);
  router.post('/attendance/punch-out', ctrl.punchOut);
  router.get('/attendance/me', ctrl.getMyAttendance);
  router.get('/admin/attendance', ctrl.adminListAttendance);
  router.patch('/admin/attendance/:id', validate(hrmValidator, 'adminMarkAttendance'), ctrl.adminMarkAttendance);
  router.post('/admin/attendance/mark', validate(hrmValidator, 'adminMarkAttendance'), ctrl.adminMarkAttendance);

  // 2. Leave Routes
  router.post('/leaves', upload.single('attachment'), validate(hrmValidator, 'submitLeave'), ctrl.submitLeave);
  router.get('/leaves/me', ctrl.getMyLeaves);
  router.delete('/leaves/:id', ctrl.cancelLeave);
  router.get('/admin/leaves', ctrl.adminGetLeaveQueue);
  router.patch('/admin/leaves/:id/review', validate(hrmValidator, 'adminReviewLeave'), ctrl.adminReviewLeave);
  router.get('/admin/leaves/stats', ctrl.adminGetLeaveStats);

  // 3. Payslip Routes
  router.get('/payslips/me', ctrl.getMyPayslips);
  router.get('/admin/payslips', ctrl.adminListPayslips);
  router.post('/admin/payslips/generate', validate(hrmValidator, 'generatePayslip'), ctrl.generatePayslip);
  router.patch('/admin/payslips/:id/mark-paid', ctrl.adminMarkPaid);
  router.get('/admin/payslips/stats', ctrl.adminGetPayslipStats);

  return router;
}
