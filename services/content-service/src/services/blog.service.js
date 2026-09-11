import { NotFoundError } from '@getready/errors';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export class BlogService {
  constructor(blogRepository) {
    this.blogRepository = blogRepository;
  }

  async getHome() {
    return this.blogRepository.findHome();
  }

  async listPublic(options) {
    return this.blogRepository.findPublished(options);
  }

  async getPublic(idOrSlug) {
    const blog = await this.blogRepository.findByIdOrSlug(idOrSlug);
    if (!blog || blog.status !== 'PUBLISHED') {
      throw new NotFoundError('Blog not found');
    }
    return blog;
  }

  async like(id) {
    const blog = await this.blogRepository.incrementLikes(id);
    if (!blog) throw new NotFoundError('Blog not found');
    return { likesCount: blog.likesCount };
  }

  async listManage(options) {
    return this.blogRepository.listManage(options);
  }

  async getById(id) {
    const blog = await this.blogRepository.findByIdOrSlug(id);
    if (!blog) throw new NotFoundError('Blog not found');
    return blog;
  }

  async create(data) {
    if (!data.slug && data.title) {
      data.slug = slugify(data.title) + '-' + Date.now();
    }
    if (data.status === 'PUBLISHED' && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    return this.blogRepository.create(data);
  }

  async update(id, data) {
    if (data.status === 'PUBLISHED') {
      data.publishedAt = new Date();
    }
    const blog = await this.blogRepository.update(id, data);
    if (!blog) throw new NotFoundError('Blog not found');
    return blog;
  }

  async remove(id) {
    const blog = await this.blogRepository.delete(id);
    if (!blog) throw new NotFoundError('Blog not found');
    return { success: true };
  }
}
