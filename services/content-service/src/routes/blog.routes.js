import { Router } from 'express';
import multer from 'multer';
import { validate } from '@getready/validation';
import { blogValidator } from '../validators/blog.validation.js';

const upload = multer({ dest: 'uploads/' });

export function createBlogRoutes(blogController) {
  const router = Router();

  router.get('/home', validate(blogValidator.homeBlogsQuery, 'query'), blogController.home);
  router.get('/', validate(blogValidator.listBlogsQuery, 'query'), blogController.listPublic);
  router.post('/:id/like', validate(blogValidator.blogIdParams, 'params'), blogController.like);

  router.get('/manage', validate(blogValidator.manageBlogsQuery, 'query'), blogController.listManage);
  router.get('/manage/:id', validate(blogValidator.blogIdParams, 'params'), blogController.getById);
  router.post('/', upload.single('file'), validate(blogValidator.createBlog), blogController.create);
  router.get('/:id', validate(blogValidator.blogIdParams, 'params'), blogController.getPublic);
  router.patch('/:id', validate(blogValidator.blogIdParams, 'params'), upload.single('file'), validate(blogValidator.updateBlog), blogController.update);
  router.delete('/:id', validate(blogValidator.blogIdParams, 'params'), blogController.remove);

  return router;
}
