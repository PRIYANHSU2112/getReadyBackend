import { NotFoundError } from '@getready/errors';
import { contentCache } from '../cache/content.cache.js';

const HOME_BANNERS_CACHE_KEY = 'home:banners:active';
const HOME_BANNERS_CACHE_TTL = 600; // 10 minutes

export class BannerService {
  constructor(bannerRepository) {
    this.bannerRepository = bannerRepository;
  }

  async getHomeBanners() {
    // 1. Redis Cache lookup (< 5ms)
    const cached = await contentCache.get(HOME_BANNERS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // 2. Database query with index sort (< 50ms)
    const banners = await this.bannerRepository.findActive();
    const formatted = (banners || []).map((b) => ({
      id: b._id?.toString() || b.id,
      title: b.title,
      subtitle: b.subtitle || null,
      imageUrl: b.imageUrl,
      redirectUrl: b.redirectUrl || null,
      category: b.category || null,
      displayOrder: b.displayOrder || 0,
      metadata: b.metadata || {},
    }));

    // 3. Store in cache
    await contentCache.set(HOME_BANNERS_CACHE_KEY, formatted, HOME_BANNERS_CACHE_TTL);
    return formatted;
  }

  async listActive() {
    return this.getHomeBanners();
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
    const banner = await this.bannerRepository.create(data);
    await this.#invalidateCache();
    return banner;
  }

  async update(id, data) {
    const banner = await this.bannerRepository.update(id, data);
    if (!banner) throw new NotFoundError('Banner not found');
    await this.#invalidateCache();
    return banner;
  }

  async remove(id) {
    const banner = await this.bannerRepository.delete(id);
    if (!banner) throw new NotFoundError('Banner not found');
    await this.#invalidateCache();
    return { success: true };
  }

  async getAdminStats(query = {}) {
    let startDate = query.startDate;
    let endDate = query.endDate;

    if (query.period && !startDate) {
      const now = new Date();
      if (query.period === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (query.period === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (query.period === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      }
    }

    return this.bannerRepository.getAdminStats({ startDate, endDate });
  }

  async #invalidateCache() {
    await contentCache.del(HOME_BANNERS_CACHE_KEY);
    await contentCache.delByPattern('home:banners:*');
  }
}

