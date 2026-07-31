import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CategoryService } from '../../../modules/category/category.service.js';
import { AppError } from '../../../common/errors/AppError.js';

describe('CategoryService (unit)', () => {
  let categoryRepository;
  let cacheService;
  let service;

  beforeEach(() => {
    categoryRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findActiveById: jest.fn(),
      findByIdAny: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      reorder: jest.fn(),
      listPublicSlim: jest.fn(),
      findPublicBySlug: jest.fn(),
      bulkSetActive: jest.fn(),
      softDeleteMany: jest.fn(),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };
    service = new CategoryService(categoryRepository, cacheService);
  });

  it('rejects duplicate category slug on create', async () => {
    categoryRepository.findBySlug.mockResolvedValue({ _id: 'x', slug: 'hair' });

    await expect(
      service.create({ name: 'Hair', slug: 'hair' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('auto-generates slug from name', async () => {
    categoryRepository.create.mockResolvedValue({
      _id: '64f0c2a1b4e1c2d3e4f50660',
      name: 'Hair Care',
      slug: 'hair-care',
    });

    await service.create({ name: 'Hair Care' });

    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'hair-care' }),
    );
    expect(cacheService.delByPattern).toHaveBeenCalled();
  });

  it('rejects defaultPriceRange when min > max', async () => {
    await expect(
      service.create({
        name: 'Hair',
        defaultPriceRange: { min: 500, max: 100 },
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('listPublic returns slim cached payload', async () => {
    const slim = [
      {
        id: '1',
        name: 'Hair',
        slug: 'hair',
        description: null,
        image: { url: null, publicId: null },
        icon: null,
        color: null,
        displayOrder: 1,
        isFeatured: true,
        defaultPriceRange: { min: 100, max: 500 },
      },
    ];
    categoryRepository.listPublicSlim.mockResolvedValue(slim);

    const first = await service.listPublic({});
    const second = await service.listPublic({});

    expect(first).toEqual(slim);
    expect(second).toEqual(slim);
    expect(categoryRepository.listPublicSlim).toHaveBeenCalledTimes(1);
    expect(first[0]).not.toHaveProperty('metadata');
    expect(first[0]).not.toHaveProperty('deletedAt');
  });

  it('reorder invalidates public cache', async () => {
    await service.reorder([{ id: 'a', displayOrder: 0 }]);
    expect(categoryRepository.reorder).toHaveBeenCalled();
    expect(cacheService.delByPattern).toHaveBeenCalled();
  });

  it('restore rejects when not deleted', async () => {
    categoryRepository.findByIdAny.mockResolvedValue({
      _id: 'c1',
      slug: 'hair',
      deletedAt: null,
    });

    await expect(service.restore('c1')).rejects.toBeInstanceOf(AppError);
  });
});
