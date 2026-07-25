import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { FilterService } from '../../../modules/filter/filter.service.js';
import { AppError } from '../../../common/errors/AppError.js';
import { FilterSelectionType, FilterDisplayType } from '../../../common/constants/enums.js';
import { slugify } from '../../../common/utils/slug.util.js';

describe('slugify', () => {
  it('generates url-safe slugs', () => {
    expect(slugify('Skin Type')).toBe('skin-type');
    expect(slugify('  Price Range!! ')).toBe('price-range');
  });
});

describe('FilterService (unit)', () => {
  let filterRepository;
  let filterValueRepository;
  let cacheService;
  let service;

  beforeEach(() => {
    filterRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findActiveById: jest.fn(),
      findByIdAny: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      reorder: jest.fn(),
      listPublicSlim: jest.fn(),
      bulkSetActive: jest.fn(),
      softDeleteMany: jest.fn(),
    };
    filterValueRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findActiveById: jest.fn(),
      findByIdAny: jest.fn(),
      create: jest.fn(),
      clearDefaults: jest.fn(),
      softDeleteByFilterId: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      reorder: jest.fn(),
      listByFilter: jest.fn(),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };
    service = new FilterService(filterRepository, filterValueRepository, cacheService);
  });

  it('rejects duplicate filter slug on create', async () => {
    filterRepository.findBySlug.mockResolvedValue({ _id: 'x', slug: 'skin-type' });

    await expect(
      service.create({ name: 'Skin Type', slug: 'skin-type' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(filterRepository.create).not.toHaveBeenCalled();
  });

  it('auto-generates slug from name', async () => {
    filterRepository.create.mockResolvedValue({
      _id: '64f0c2a1b4e1c2d3e4f50650',
      name: 'Skin Type',
      slug: 'skin-type',
      displayType: FilterDisplayType.CHIPS,
    });

    await service.create({ name: 'Skin Type' });

    expect(filterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'skin-type' }),
    );
    expect(cacheService.delByPattern).toHaveBeenCalled();
  });

  it('listPublic returns slim cached payload', async () => {
    const slim = [
      {
        id: '1',
        name: 'Skin Type',
        slug: 'skin-type',
        displayType: 'chips',
        selectionType: 'multiple',
        isRequired: false,
        displayOrder: 1,
        values: [
          {
            id: 'v1',
            label: 'Oily',
            value: 'oily',
            displayOrder: 1,
            isDefault: false,
            icon: null,
          },
        ],
      },
    ];
    filterRepository.listPublicSlim.mockResolvedValue(slim);

    const first = await service.listPublic({ scope: 'services' });
    const second = await service.listPublic({ scope: 'services' });

    expect(first).toEqual(slim);
    expect(second).toEqual(slim);
    expect(filterRepository.listPublicSlim).toHaveBeenCalledTimes(1);
    expect(first[0]).not.toHaveProperty('image');
    expect(first[0]).not.toHaveProperty('metadata');
    expect(first[0].values[0]).not.toHaveProperty('image');
  });

  it('clears other defaults when setting isDefault on single-select', async () => {
    filterRepository.findActiveById.mockResolvedValue({
      _id: 'f1',
      selectionType: FilterSelectionType.SINGLE,
      deletedAt: null,
    });
    filterValueRepository.create.mockResolvedValue({
      _id: 'v1',
      filterId: 'f1',
      label: 'All',
      value: 'all',
      slug: 'all',
      isDefault: true,
    });

    await service.createValue('f1', {
      label: 'All',
      value: 'all',
      isDefault: true,
    });

    expect(filterValueRepository.clearDefaults).toHaveBeenCalledWith('f1');
  });

  it('reorder invalidates public cache', async () => {
    await service.reorder([{ id: 'a', displayOrder: 0 }]);
    expect(filterRepository.reorder).toHaveBeenCalled();
    expect(cacheService.delByPattern).toHaveBeenCalled();
  });

  it('restore rejects when not deleted', async () => {
    filterRepository.findByIdAny.mockResolvedValue({
      _id: 'f1',
      slug: 'skin-type',
      deletedAt: null,
    });

    await expect(service.restore('f1')).rejects.toBeInstanceOf(AppError);
  });
});
