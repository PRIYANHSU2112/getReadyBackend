import { Router } from 'express';
import multer from 'multer';
import { validate } from '@getready/validation';
import { beauticianValidator } from '../validators/beautician.validation.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const kycUpload = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 },
  { name: 'selfieWithId', maxCount: 1 },
]);

export function createBeauticianProfileRoutes(ctrl) {
  const router = Router();

  // Self routes
  router.get('/me', ctrl.getMyProfile);
  router.post('/', validate(beauticianValidator, 'createProfile'), ctrl.createProfile);
  router.patch('/me', validate(beauticianValidator, 'updateProfile'), ctrl.updateProfile);
  router.post('/me/selfie', kycUpload, ctrl.uploadSelfie);
  router.post('/me/submit', ctrl.submitForReview);

  // Work history
  router.get('/me/work-history', ctrl.getWorkHistory);
  router.post('/me/work-history', validate(beauticianValidator, 'createWorkHistory'), ctrl.addWorkHistory);
  router.patch('/me/work-history/:id', ctrl.updateWorkHistory);
  router.delete('/me/work-history/:id', ctrl.deleteWorkHistory);

  // Certificates
  router.get('/me/certificates', ctrl.getCertificates);
  router.post('/me/certificates', upload.single('file'), validate(beauticianValidator, 'createCertificate'), ctrl.addCertificate);
  router.patch('/me/certificates/:id', upload.single('file'), ctrl.updateCertificate);
  router.delete('/me/certificates/:id', ctrl.deleteCertificate);

  // Admin routes
  router.post('/admin/create', validate(beauticianValidator, 'adminCreateProfile'), ctrl.adminCreate);
  router.get('/kyc/queue', ctrl.getKycQueue);
  router.get('/', ctrl.listProfiles);
  router.get('/:id', ctrl.getProfileById);
  router.patch('/:id/kyc/documents/:docId/review', validate(beauticianValidator, 'reviewKycDocument'), ctrl.reviewKycDocument);
  router.patch('/:id/kyc/selfie/review', validate(beauticianValidator, 'reviewSelfie'), ctrl.reviewKycSelfie);
  router.post('/:id/kyc/request-reupload', validate(beauticianValidator, 'requestReupload'), ctrl.requestReupload);
  router.patch('/:id/services', validate(beauticianValidator, 'updateEligibleServices'), ctrl.updateEligibleServices);
  router.patch('/:id/availability', validate(beauticianValidator, 'updateAvailability'), ctrl.updateAvailability);
  router.patch('/:id/status', validate(beauticianValidator, 'adminReviewProfile'), ctrl.updateStatus);
  router.patch('/:id/review', validate(beauticianValidator, 'adminReviewProfile'), ctrl.reviewProfile);
  router.patch('/:id/kyc-review', validate(beauticianValidator, 'adminReviewKyc'), ctrl.reviewKyc);
  router.patch('/certificates/:id/review', ctrl.reviewCertificate);

  return router;
}

export function createSkillRoutes(ctrl) {
  const router = Router();
  router.get('/', ctrl.list);
  router.get('/:id', ctrl.getById);
  router.post('/', validate(beauticianValidator, 'createSkill'), ctrl.create);
  router.patch('/:id', ctrl.update);
  router.delete('/:id', ctrl.remove);
  return router;
}

export function createBankDetailRoutes(ctrl) {
  const router = Router();
  router.get('/me', ctrl.getMyBankDetail);
  router.put('/me', upload.single('file'), validate(beauticianValidator, 'createBankDetail'), ctrl.upsertBankDetail);
  router.delete('/me', ctrl.deleteBankDetail);

  router.get('/', ctrl.listBankDetails);
  router.get('/:id', ctrl.getBankDetailById);
  router.patch('/:id/review', ctrl.reviewBankDetail);
  return router;
}
