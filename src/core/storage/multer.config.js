import multer from 'multer';

/**
 * Memory storage multer — files buffered then uploaded via StorageService.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export const singleUpload = (fieldName = 'file') => upload.single(fieldName);
export const multiUpload = (fieldName = 'files', maxCount = 5) =>
  upload.array(fieldName, maxCount);
