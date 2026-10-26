import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

export function createUploadRoutes(uploadCtrl) {
  const router = Router();

  router.post(
    '/image',
    upload.single('file'),
    uploadCtrl.uploadImage
  );

  return router;
}
