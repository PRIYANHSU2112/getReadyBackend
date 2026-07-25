import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BannerService } from '../../../modules/banner/banner.service.js';
import { AppError } from '../../../common/errors/AppError.js';
import { BannerStatus } from '../../../common/constants/enums.js';
import { MAX_BANNERS_PER_POSITION } from '../../../common/constants/banner.js';

const fakeFile = {
  buffer: Buffer.from('fake-image'),
  originalname: 'banner.jpg',
  mimetype: 'image/jpeg',
};

const mockStorage = {
  upload: jest.fn().mockResolvedValue({
    url: 'https://cdn.example.com/banners/x.jpg',
    key: 'banners/x.jpg',
  }),
  delete: jest.fn().mockResolvedValue(undefined),
};

describe('BannerService (unit)', () => {
  beforeEach(() => {
    mockStorage.upload.mockClear();
    mockStorage.delete.mockClear();
  });

  it('rejects create without image file', async () => {
    const service = new BannerService({ create: jest.fn() }, null, mockStorage);

    await expect(
      service.create({
        title: 'No file',
        position: 1,
        status: BannerStatus.INACTIVE,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it(`rejects create when position already has ${MAX_BANNERS_PER_POSITION} active banners`, async () => {
    const bannerRepository = {
      countActiveAtPosition: jest.fn().mockResolvedValue(MAX_BANNERS_PER_POSITION),
      create: jest.fn(),
    };
    const service = new BannerService(bannerRepository, null, mockStorage);

    await expect(
      service.create(
        {
          title: 'Overflow',
          position: 1,
          status: BannerStatus.ACTIVE,
        },
        fakeFile,
      ),
    ).rejects.toBeInstanceOf(AppError);

    expect(bannerRepository.create).not.toHaveBeenCalled();
  });

  it('rejects invalid schedule window on create', async () => {
    const bannerRepository = {
      countActiveAtPosition: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    };
    const service = new BannerService(bannerRepository, null, mockStorage);

    await expect(
      service.create(
        {
          title: 'Bad window',
          position: 1,
          status: BannerStatus.INACTIVE,
          startAt: '2026-08-01T00:00:00.000Z',
          endAt: '2026-07-01T00:00:00.000Z',
        },
        fakeFile,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(bannerRepository.create).not.toHaveBeenCalled();
  });

  it('uploads image on create', async () => {
    const bannerRepository = {
      countActiveAtPosition: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        _id: '64f0c2a1b4e1c2d3e4f50640',
        title: 'Summer',
        image: {
          url: 'https://cdn.example.com/banners/x.jpg',
          publicId: 'banners/x.jpg',
        },
        position: 1,
        serviceIds: [],
      }),
    };
    const service = new BannerService(bannerRepository, null, mockStorage);

    const result = await service.create(
      { title: 'Summer', position: 1, status: BannerStatus.INACTIVE },
      fakeFile,
    );

    expect(mockStorage.upload).toHaveBeenCalledWith(fakeFile);
    expect(bannerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        image: {
          url: 'https://cdn.example.com/banners/x.jpg',
          publicId: 'banners/x.jpg',
        },
      }),
    );
    expect(result.imageUrl).toBe('https://cdn.example.com/banners/x.jpg');
  });

  it('returns 404 when banner missing', async () => {
    const bannerRepository = {
      findActiveById: jest.fn().mockResolvedValue(null),
    };
    const service = new BannerService(bannerRepository, null, mockStorage);

    await expect(service.getById('deadbeefdeadbeefdeadbeef')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('soft-deletes, removes stored image, and invalidates cache', async () => {
    const bannerRepository = {
      findActiveById: jest.fn().mockResolvedValue({
        _id: '64f0c2a1b4e1c2d3e4f50640',
        status: BannerStatus.ACTIVE,
        image: { url: 'https://cdn.example.com/b.jpg', publicId: 'banners/old.jpg' },
      }),
      softDelete: jest.fn().mockResolvedValue({}),
    };
    const cacheService = {
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BannerService(bannerRepository, cacheService, mockStorage);

    await service.remove('64f0c2a1b4e1c2d3e4f50640');

    expect(bannerRepository.softDelete).toHaveBeenCalledWith('64f0c2a1b4e1c2d3e4f50640');
    expect(mockStorage.delete).toHaveBeenCalledWith('banners/old.jpg');
    expect(cacheService.delByPattern).toHaveBeenCalled();
  });
});
