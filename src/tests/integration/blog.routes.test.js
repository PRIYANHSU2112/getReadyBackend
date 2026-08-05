import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { BlogModel } from '../../modules/blog/blog.model.js';
import { CategoryModel } from '../../modules/category/category.model.js';
import { UserRole, BlogStatus } from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

describe('Blog routes (integration)', () => {
  let app;
  let adminToken;
  let customerToken;
  let skinCategory;
  let hairCategory;

  beforeEach(async () => {
    const jwt = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: jwt,
      cacheService: new MemoryCacheService(),
      storageService: {
        upload: async (file) => ({
          url: `https://cdn.example.com/blogs/${file.originalname}`,
          key: `blogs/${file.originalname}`,
        }),
        delete: async () => undefined,
      },
    });
    app = createApp({ shared });

    await seedRbacForTests();

    await UserModel.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });

    const customer = await UserModel.create({
      name: 'Customer One',
      phone: '+919811100001',
      role: UserRole.CUSTOMER,
    });

    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = login.body.data.accessToken;

    customerToken = jwt.sign({
      sub: customer._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100001',
    });

    skinCategory = await CategoryModel.create({
      name: 'Skin Care',
      slug: 'skin-care',
      isActive: true,
      displayOrder: 1,
    });
    hairCategory = await CategoryModel.create({
      name: 'Hair',
      slug: 'hair',
      isActive: true,
      displayOrder: 2,
    });
  });

  async function createBlog(fields = {}) {
    return request(app)
      .post('/api/v1/blogs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '5 Facial Routines for Glowing Skin',
        excerpt: 'Keep your skin hydrated...',
        content: '<p>Full content about skincare routines and tips for monsoon.</p>',
        categoryId: skinCategory._id.toString(),
        status: BlogStatus.PUBLISHED,
        isFeatured: true,
        authorName: 'Rebecca',
        coverImageUrl: 'https://cdn.example.com/blogs/cover.jpg',
        ...fields,
      });
  }

  it('admin create with existing Category → home chips + latest + popular', async () => {
    const created = await createBlog();
    expect(created.status).toBe(201);
    expect(created.body.data.categoryId).toBe(skinCategory._id.toString());
    expect(created.body.data.categoryName).toBe('Skin Care');
    expect(created.body.data.categorySlug).toBe('skin-care');
    expect(created.body.data.content).toBeDefined();

    const home = await request(app).get('/api/v1/blogs/home');
    expect(home.status).toBe(200);
    expect(home.body.data.categories.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['skin-care', 'hair']),
    );
    expect(home.body.data.latest?.title).toBe('5 Facial Routines for Glowing Skin');
    expect(home.body.data.latest?.content).toBeUndefined();
    expect(home.body.data.popular.items).toHaveLength(1);
    expect(home.body.data.popular.items[0].content).toBeUndefined();
  });

  it('filters popular by categoryId', async () => {
    await createBlog({ title: 'Skin Blog', slug: 'skin-blog' });
    await createBlog({
      title: 'Hair Blog',
      slug: 'hair-blog',
      categoryId: hairCategory._id.toString(),
      isFeatured: false,
    });

    const home = await request(app)
      .get('/api/v1/blogs/home')
      .query({ categoryId: hairCategory._id.toString() });

    expect(home.status).toBe(200);
    expect(home.body.data.popular.items).toHaveLength(1);
    expect(home.body.data.popular.items[0].slug).toBe('hair-blog');
    expect(home.body.data.latest?.slug).toBe('hair-blog');
  });

  it('detail includes content; like twice increments once', async () => {
    const created = await createBlog({ slug: 'like-me' });
    const blogId = created.body.data.id;

    const detail = await request(app).get(`/api/v1/blogs/${blogId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.content).toContain('Full content');

    const bySlug = await request(app).get('/api/v1/blogs/like-me');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.slug).toBe('like-me');

    const like1 = await request(app)
      .post(`/api/v1/blogs/${blogId}/like`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(like1.status).toBe(200);
    expect(like1.body.data.likesCount).toBe(1);
    expect(like1.body.data.alreadyLiked).toBe(false);

    const like2 = await request(app)
      .post(`/api/v1/blogs/${blogId}/like`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(like2.status).toBe(200);
    expect(like2.body.data.likesCount).toBe(1);
    expect(like2.body.data.alreadyLiked).toBe(true);

    const fromDb = await BlogModel.findById(blogId).lean();
    expect(fromDb.likesCount).toBe(1);
  });

  it('cache busts after publish/update', async () => {
    const draft = await createBlog({
      title: 'Draft Post',
      slug: 'draft-post',
      status: BlogStatus.DRAFT,
      isFeatured: false,
    });
    expect(draft.status).toBe(201);

    const homeEmpty = await request(app).get('/api/v1/blogs/home');
    expect(homeEmpty.status).toBe(200);
    expect(homeEmpty.body.data.latest).toBeNull();
    expect(homeEmpty.body.data.popular.items).toHaveLength(0);

    const published = await request(app)
      .patch(`/api/v1/blogs/${draft.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: BlogStatus.PUBLISHED, isFeatured: true });
    expect(published.status).toBe(200);

    const homeAfter = await request(app).get('/api/v1/blogs/home');
    expect(homeAfter.status).toBe(200);
    expect(homeAfter.body.data.latest?.slug).toBe('draft-post');
    expect(homeAfter.body.data.popular.items).toHaveLength(1);
  });

  it('public list excludes drafts and content', async () => {
    await createBlog({ title: 'Live', slug: 'live-post' });
    await createBlog({
      title: 'Hidden',
      slug: 'hidden-post',
      status: BlogStatus.DRAFT,
      isFeatured: false,
    });

    const list = await request(app).get('/api/v1/blogs').query({ sort: 'latest' });
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].slug).toBe('live-post');
    expect(list.body.data[0].content).toBeUndefined();
  });

  it('rejects create without blogs.create permission', async () => {
    const res = await request(app)
      .post('/api/v1/blogs')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Nope',
        categoryId: skinCategory._id.toString(),
      });
    expect(res.status).toBe(403);
  });
});
