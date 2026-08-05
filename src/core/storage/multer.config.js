import multer from 'multer';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

// Memory storage — file buffer in RAM before streaming to S3
const multerStorage = multer.memoryStorage();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new AppError(
        'Only image files are allowed (jpeg, png, webp, gif)',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      ),
    );
  },
});

export const singleUpload = (fieldName = 'file') => upload.single(fieldName);
export const multiUpload = (fieldName = 'files', maxCount = 5) =>
  upload.array(fieldName, maxCount);

/** Run multer only for multipart so JSON PATCH still works */
export function optionalSingleUpload(fieldName = 'file') {
  const middleware = singleUpload(fieldName);
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    return middleware(req, res, next);
  };
}

/** Optional 3-file KYC upload: selfieImage, idCardFront, idCardBack */
export function optionalKycUpload() {
  const middleware = upload.fields([
    { name: 'selfieImage', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
    { name: 'file', maxCount: 1 }, // Fallback for single file upload
  ]);
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    return middleware(req, res, next);
  };
}

/** Optional multi-file upload (field `files`) + optional `thumbnail`. */
export function optionalServiceMediaUpload() {
  const middleware = upload.fields([
    { name: 'files', maxCount: 5 },
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]);
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    return middleware(req, res, (err) => {
      if (err) return next(err);
      // Normalize to req.files as flat array with fieldname
      if (req.files && !Array.isArray(req.files)) {
        const flat = [];
        for (const [fieldname, list] of Object.entries(req.files)) {
          for (const f of list) flat.push(f);
        }
        req.files = flat;
      }
      return next();
    });
  };
}

/** Optional multi-file upload for packages (fields `images`, `files`, `thumbnail`, `file`). */
export function optionalPackageMediaUpload() {
  const middleware = upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'file', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'thumbnail', maxCount: 1 },
  ]);
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    return middleware(req, res, (err) => {
      if (err) return next(err);
      if (req.files && !Array.isArray(req.files)) {
        const flat = [];
        for (const [fieldname, list] of Object.entries(req.files)) {
          for (const f of list) flat.push(f);
        }
        req.files = flat;
      }
      return next();
    });
  };
}

