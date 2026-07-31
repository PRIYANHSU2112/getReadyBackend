import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BannerService } from '../../../modules/banner/banner.service.js';
import { BannerStatus } from '../../../common/constants/enums.js';
import { AppError } from '../../../common/errors/AppError.js';

describe('BannerService categoryId (unit)', () => {
  let bannerRepository;
  let categoryRepository;
  let storageService;
  let service;

  beforeEach(() => {
    bannerRepository = {
      create: jest.fn(),
      countActiveAtPosition: jest.fn().mockResolvedValue(0),
    };
    categoryRepository = {
      findActiveById: jest.fn(),
    };
    storageService = {
      upload: jest.fn().mockResolvedValue({
        url: 'https://cdn.example.com/banners/x.png',
        key: 'banners/x.png',
      }),
    };
    service = new BannerService(
      bannerRepository,
      null,
      storageService,
      categoryRepository,
    );
  });

  it('denormalizes category slug into serviceCategory on create', async () => {
    categoryRepository.findActiveById.mockResolvedValue({
      _id: '64f0c2a1b4e1c2d3e4f50660',
      slug: 'hair',
      isActive: true,
      deletedAt: null,
    });
    bannerRepository.create.mockResolvedValue({
      _id: 'b1',
      title: 'Offer',
      categoryId: '64f0c2a1b4e1c2d3e4f50660',
      serviceCategory: 'hair',
      position: 1,
      status: BannerStatus.INACTIVE,
      image: { url: 'https://cdn.example.com/banners/x.png', publicId: 'banners/x.png' },
    });

    await service.create(
      {
        title: 'Offer',
        position: 1,
        categoryId: '64f0c2a1b4e1c2d3e4f50660',
        status: BannerStatus.INACTIVE,
      },
      { originalname: 'x.png', buffer: Buffer.from('x') },
    );

    expect(bannerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: '64f0c2a1b4e1c2d3e4f50660',
        serviceCategory: 'hair',
      }),
    );
  });

  it('rejects inactive or missing categoryId', async () => {
    categoryRepository.findActiveById.mockResolvedValue(null);

    await expect(
      service.create(
        {
          title: 'Offer',
          position: 1,
          categoryId: '64f0c2a1b4e1c2d3e4f50660',
        },
        { originalname: 'x.png', buffer: Buffer.from('x') },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
