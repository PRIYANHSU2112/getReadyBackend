import { CategoryModel } from '../models/category.model.js';
import { ServiceModel } from '../models/service.model.js';
import { PackageModel } from '../models/package.model.js';
import { CouponModel } from '../models/coupon.model.js';
import { catalogCache } from '../cache/catalog.cache.js';
import { logger } from '@getready/logger';

const FEED_CACHE_PREFIX = 'home:feed:v1';
const FEED_CACHE_TTL = 600; // 10 minutes

export class HomeFeedService {
  /**
   * Ultra-fast Materialized View: < 50ms with Redis, < 200ms DB fallback
   */
  async getFeed({ city = 'all', refresh = false } = {}) {
    const cacheKey = `${FEED_CACHE_PREFIX}:${city.toLowerCase().trim()}`;

    // 1. Try Redis Materialized View cache first
    if (!refresh) {
      const cached = await catalogCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. Precompute/Materialize feed from primary store concurrently
    return this.precomputeAndCache(city);
  }

  async precomputeAndCache(city = 'all') {
    const cacheKey = `${FEED_CACHE_PREFIX}:${city.toLowerCase().trim()}`;
    const startTime = Date.now();

    try {
      const now = new Date();

      // Parallel lean indexed queries
      const [categories, featuredServices, packages, coupons] = await Promise.all([
        CategoryModel.find({ isActive: true, deletedAt: null })
          .sort({ displayOrder: 1, createdAt: 1 })
          .limit(10)
          .select('_id name slug image displayOrder')
          .lean(),

        ServiceModel.find({ isActive: true, status: 'APPROVED', deletedAt: null })
          .sort({ displayOrder: 1, ratingAvg: -1 })
          .limit(8)
          .select('_id name slug price discountedPrice durationMinMinutes durationMaxMinutes thumbnail images ratingAvg ratingCount badges isFeatured')
          .lean(),

        PackageModel.find({ isActive: true, status: 'APPROVED', deletedAt: null })
          .sort({ ratingAvg: -1, createdAt: -1 })
          .limit(6)
          .select('_id name slug price originalPrice discountedPrice durationMinMinutes durationMaxMinutes thumbnail badges ratingAvg ratingCount items description')
          .lean(),

        CouponModel.find({
          isActive: true,
          status: 'ACTIVE',
          deletedAt: null,
          validTo: { $gte: now },
        })
          .sort({ discountValue: -1 })
          .limit(5)
          .select('_id code name description discountType discountValue minOrderValue maxDiscountAmount validTo')
          .lean(),
      ]);

      // Format Categories for User Home
      const formattedCategories = categories.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        image: c.image?.url || null,
        displayOrder: c.displayOrder || 0,
      }));

      // Format Featured Services for User Home
      const formattedServices = featuredServices.map((s) => {
        const discountPercent =
          s.discountedPrice && s.price > s.discountedPrice
            ? Math.round(((s.price - s.discountedPrice) / s.price) * 100)
            : 0;

        return {
          id: s._id.toString(),
          title: s.name,
          slug: s.slug,
          price: s.discountedPrice || s.price,
          originalPrice: s.price,
          discount: discountPercent > 0 ? `${discountPercent}% OFF` : null,
          duration: `${s.durationMinMinutes || 30}-${s.durationMaxMinutes || 45} mins`,
          rating: s.ratingAvg || 4.8,
          ratingCount: s.ratingCount || 0,
          thumbnail: s.thumbnail?.url || (s.images?.[0]?.url ?? null),
          badges: s.badges || [],
          bestseller: s.ratingAvg >= 4.8,
        };
      });

      // Format Packages (Spotlight Package + Trending Packages)
      const formattedPackages = packages.map((p) => {
        const originalPrice = p.originalPrice || p.price;
        const currentPrice = p.discountedPrice || p.price;
        const discountPercent =
          originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

        return {
          id: p._id.toString(),
          title: p.name,
          slug: p.slug,
          description: p.description || null,
          price: currentPrice,
          originalPrice,
          discount: discountPercent > 0 ? `${discountPercent}% OFF` : null,
          duration: `${p.durationMinMinutes || 60}-${p.durationMaxMinutes || 90} mins`,
          rating: p.ratingAvg || 4.9,
          ratingCount: p.ratingCount || 0,
          thumbnail: p.thumbnail?.url || null,
          badges: p.badges || [],
          servicesIncluded: (p.items || []).map((i) => i.name || 'Service'),
        };
      });

      const spotlightPackage = formattedPackages[0] || null;
      const trendingPackages = formattedPackages.slice(1);

      // Format Coupons / Public Offers
      const formattedOffers = coupons.map((cp) => ({
        id: cp._id.toString(),
        code: cp.code,
        title: cp.name || `${cp.code} Special`,
        description: cp.description || 'Valid on all salon services',
        discount: cp.discountType === 'PERCENTAGE' ? `${cp.discountValue}% OFF` : `₹${cp.discountValue} FLAT`,
        discountType: cp.discountType,
        discountValue: cp.discountValue,
        minOrder: cp.minOrderValue || 0,
        maxDiscount: cp.maxDiscountAmount || null,
        validTill: cp.validTo ? new Date(cp.validTo).toISOString().split('T')[0] : null,
      }));

      const feed = {
        categories: formattedCategories,
        featuredServices: formattedServices,
        spotlightPackage,
        trendingPackages,
        offers: formattedOffers,
        meta: {
          city,
          generatedAt: new Date().toISOString(),
          computeTimeMs: Date.now() - startTime,
        },
      };

      // 3. Save Materialized View in Redis
      await catalogCache.set(cacheKey, feed, FEED_CACHE_TTL);
      logger.info({ city, computeTimeMs: feed.meta.computeTimeMs }, 'Home feed materialized view computed and cached');

      return feed;
    } catch (err) {
      logger.error({ err, city }, 'Failed to compute home feed materialized view');
      throw err;
    }
  }

  async invalidateFeed(city = null) {
    if (city) {
      await catalogCache.del(`${FEED_CACHE_PREFIX}:${city.toLowerCase().trim()}`);
    } else {
      await catalogCache.delByPattern(`${FEED_CACHE_PREFIX}:*`);
    }
    logger.info({ city }, 'Home feed cache invalidated');
  }
}

export const homeFeedService = new HomeFeedService();
export default homeFeedService;
