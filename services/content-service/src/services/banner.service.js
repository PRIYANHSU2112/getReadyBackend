import { NotFoundError } from '@getready/errors';

export class BannerService {
  constructor(bannerRepository) {
    this.bannerRepository = bannerRepository;
  }

  async listActive() {
    return this.bannerRepository.findActive();
  }

  async list(options) {
    return this.bannerRepository.list(options);
  }

  async getById(id) {
    const banner = await this.bannerRepository.findById(id);
    if (!banner) throw new NotFoundError('Banner not found');
    return banner;
  }

  async create(data) {
    return this.bannerRepository.create(data);
  }

  async update(id, data) {
    const banner = await this.bannerRepository.update(id, data);
    if (!banner) throw new NotFoundError('Banner not found');
    return banner;
  }

  async remove(id) {
    const banner = await this.bannerRepository.delete(id);
    if (!banner) throw new NotFoundError('Banner not found');
    return { success: true };
  }
}
