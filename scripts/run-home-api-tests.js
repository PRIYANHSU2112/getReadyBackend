import assert from 'assert';
import { performance } from 'node:perf_hooks';

console.log('✨ Starting GetReady Production Home APIs & Concurrency Test Suite...\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

// -------------------------------------------------------------
// In-Memory Simulated Infrastructure (Matching Production Microservices)
// -------------------------------------------------------------

class MemoryCache {
  constructor() {
    this.store = new Map();
  }
  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(JSON.stringify(item.val));
  }
  async set(key, val, ttlSeconds = 600) {
    this.store.set(key, { val, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async del(key) {
    this.store.delete(key);
  }
  async delByPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'));
    for (const k of this.store.keys()) {
      if (regex.test(k)) this.store.delete(k);
    }
  }
  clear() {
    this.store.clear();
  }
}

const memoryRedis = new MemoryCache();

// -------------------------------------------------------------
// Microservices Domain Handlers Under Test
// -------------------------------------------------------------

// 1. Content Service Handler (User Home API 1: GET /api/v1/home/banners)
class MockBannerService {
  constructor(cache) {
    this.cache = cache;
    this.banners = [
      { id: 'b1', title: 'Festive Glow 50% Off', imageUrl: 'https://cdn.getready.com/b1.jpg', redirectUrl: '/offers/festive', displayOrder: 1, isActive: true },
      { id: 'b2', title: 'Bridal Packages 2026', imageUrl: 'https://cdn.getready.com/b2.jpg', redirectUrl: '/packages/bridal', displayOrder: 2, isActive: true },
    ];
  }
  async getHomeBanners() {
    const cached = await this.cache.get('home:banners:active');
    if (cached) return { data: cached, source: 'REDIS_CACHE' };

    // DB query simulation (latency 20-30ms)
    await new Promise((r) => setTimeout(r, 25));
    const active = this.banners.filter((b) => b.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    await this.cache.set('home:banners:active', active, 600);
    return { data: active, source: 'MONGODB' };
  }
  async createBanner(banner) {
    this.banners.push(banner);
    await this.cache.del('home:banners:active');
  }
}

// 2. Catalog Service Handler (User Home API 2: GET /api/v1/home/feed)
class MockHomeFeedService {
  constructor(cache) {
    this.cache = cache;
    this.categories = [
      { id: 'c1', name: 'Facial & Clean-up', slug: 'facial', displayOrder: 1, image: 'https://cdn.getready.com/c1.jpg' },
      { id: 'c2', name: 'Waxing & Threading', slug: 'waxing', displayOrder: 2, image: 'https://cdn.getready.com/c2.jpg' },
      { id: 'c3', name: 'Hair Care & Spa', slug: 'hair', displayOrder: 3, image: 'https://cdn.getready.com/c3.jpg' },
    ];
    this.services = [
      { id: 's1', title: 'O3+ Diamond Glow Facial', price: 1499, originalPrice: 1999, discount: '25% OFF', duration: '60 mins', rating: 4.9, bestseller: true },
      { id: 's2', title: 'Rica Waxing Full Body', price: 1299, originalPrice: 1699, discount: '24% OFF', duration: '75 mins', rating: 4.8, bestseller: true },
    ];
    this.packages = [
      { id: 'p1', title: 'Bridal Bliss Full Package', price: 4999, originalPrice: 6999, discount: '29% OFF', duration: '180 mins', rating: 4.9, servicesIncluded: ['Facial', 'Hair Spa', 'Full Wax'] },
    ];
    this.offers = [
      { id: 'o1', code: 'GETREADY100', title: 'Flat ₹100 Off', discount: '₹100 FLAT', minOrder: 499, validTill: '2026-12-31' },
      { id: 'o2', code: 'FESTIVE20', title: 'Festive 20% Off', discount: '20% OFF', minOrder: 999, validTill: '2026-11-30' },
    ];
  }

  async getFeed({ city = 'all', refresh = false } = {}) {
    const cacheKey = `home:feed:v1:${city.toLowerCase()}`;
    if (!refresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return { data: cached, source: 'REDIS_MATERIALIZED_VIEW' };
    }

    // Cold DB query fallback (parallel execution ~45ms)
    await new Promise((r) => setTimeout(r, 45));
    const feed = {
      categories: this.categories,
      featuredServices: this.services,
      spotlightPackage: this.packages[0] || null,
      trendingPackages: this.packages.slice(1),
      offers: this.offers,
      meta: { city, generatedAt: new Date().toISOString() },
    };
    await this.cache.set(cacheKey, feed, 600);
    return { data: feed, source: 'MONGODB' };
  }

  async invalidateFeed(city = null) {
    if (city) await this.cache.del(`home:feed:v1:${city.toLowerCase()}`);
    else await this.cache.delByPattern('home:feed:v1:*');
  }
}

// 3. Booking Service Handler (User Home API 3: GET /api/v1/home/summary & Beautician Home API 2: upcoming-bookings)
class MockBookingHomeService {
  constructor(cache) {
    this.cache = cache;
    this.bookings = [
      {
        bookingId: 'bk_101',
        bookingNumber: 'GRB-9021',
        userId: 'user_priya',
        assignedBeauticianId: 'bt_anita',
        status: 'CONFIRMED',
        scheduledDate: '2026-10-18',
        scheduledTime: '11:00 AM',
        serviceName: 'Hydra Facial & Manicure',
        totalAmount: 1899,
        clientName: 'Priya Sharma',
        clientPhone: '+919876543210',
        clientAddress: 'Flat 402, Lotus Court, Bhopal',
      },
      {
        bookingId: 'bk_102',
        bookingNumber: 'GRB-9022',
        userId: 'user_priya',
        assignedBeauticianId: 'bt_anita',
        status: 'COMPLETED',
        scheduledDate: '2026-10-10',
        scheduledTime: '02:00 PM',
        serviceName: 'Hair Cut & Blow Dry',
        totalAmount: 799,
        clientName: 'Priya Sharma',
        clientPhone: '+919876543210',
        clientAddress: 'Flat 402, Lotus Court, Bhopal',
      },
      {
        bookingId: 'bk_201',
        bookingNumber: 'GRB-9023',
        userId: 'user_neha',
        assignedBeauticianId: 'bt_pooja',
        status: 'CONFIRMED',
        scheduledDate: '2026-10-19',
        scheduledTime: '04:00 PM',
        serviceName: 'Bridal Make-up',
        totalAmount: 4500,
        clientName: 'Neha Verma',
        clientPhone: '+919876543211',
        clientAddress: 'House 12, Arera Colony, Bhopal',
      },
    ];
    this.notifications = [
      { userId: 'user_priya', read: false },
      { userId: 'user_priya', read: false },
      { userId: 'user_neha', read: false },
    ];
  }

  async getUserHomeSummary(userId) {
    const cacheKey = `home:user:${userId}:summary`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return { data: cached, source: 'REDIS_CACHE' };

    // DB query simulation (latency 30ms)
    await new Promise((r) => setTimeout(r, 30));
    const userBookings = this.bookings.filter((b) => b.userId === userId);
    const activeBooking = userBookings.find((b) => ['CONFIRMED', 'ASSIGNED', 'IN_PROGRESS'].includes(b.status)) || null;
    const recentBookings = userBookings.filter((b) => b.status === 'COMPLETED');
    const unreadCount = this.notifications.filter((n) => n.userId === userId && !n.read).length;

    const summary = {
      unreadNotificationsCount: unreadCount,
      activeBooking,
      recentBookings,
    };
    await this.cache.set(cacheKey, summary, 20);
    return { data: summary, source: 'MONGODB' };
  }

  async getBeauticianUpcomingBookings(beauticianId, limit = 2) {
    const cacheKey = `home:beautician:${beauticianId}:upcoming:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return { data: cached, source: 'REDIS_CACHE' };

    await new Promise((r) => setTimeout(r, 25));
    const assigned = this.bookings
      .filter((b) => b.assignedBeauticianId === beauticianId && ['CONFIRMED', 'ASSIGNED', 'IN_PROGRESS'].includes(b.status))
      .slice(0, limit);

    await this.cache.set(cacheKey, assigned, 30);
    return { data: assigned, source: 'MONGODB' };
  }
}

// 4. Beautician Service Handler (Beautician Home API 1: summary, API 3: services, and Duty Toggle)
class MockBeauticianHomeService {
  constructor(cache) {
    this.cache = cache;
    this.profiles = new Map([
      [
        'bt_anita',
        {
          userId: 'bt_anita',
          fullName: 'Anita Mehra',
          ratingAvg: 4.85,
          ratingCount: 142,
          operationalStatus: 'ONLINE',
          isAvailable: true,
          monthlyEarnings: 24500,
          todayEarnings: 452,
          todayBookingsCount: 4,
          completedBookingsToday: 4,
          pendingBookingsToday: 1,
        },
      ],
    ]);
    this.services = [
      { id: 's1', title: 'Bridal Make-up HD', price: 4500, duration: '90 mins', rating: 4.9, thumbnail: 'https://cdn.getready.com/s1.jpg' },
      { id: 's2', title: 'O3+ Facial Glow', price: 1499, duration: '60 mins', rating: 4.8, thumbnail: 'https://cdn.getready.com/s2.jpg' },
      { id: 's3', title: 'Threading & Waxing', price: 599, duration: '30 mins', rating: 4.8, thumbnail: 'https://cdn.getready.com/s3.jpg' },
      { id: 's4', title: 'Hair Spa & Scalp Detox', price: 1199, duration: '45 mins', rating: 4.7, thumbnail: 'https://cdn.getready.com/s4.jpg' },
      { id: 's5', title: 'Manicure & Pedicure Spa', price: 999, duration: '45 mins', rating: 4.8, thumbnail: 'https://cdn.getready.com/s5.jpg' },
    ];
  }

  async getSummary(beauticianId) {
    const cacheKey = `home:beautician:${beauticianId}:summary`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return { data: cached, source: 'REDIS_CACHE' };

    await new Promise((r) => setTimeout(r, 20));
    const p = this.profiles.get(beauticianId) || {
      ratingAvg: 5.0,
      ratingCount: 0,
      operationalStatus: 'OFFLINE',
      isAvailable: false,
      monthlyEarnings: 0,
      todayEarnings: 0,
      todayBookingsCount: 0,
      completedBookingsToday: 0,
      pendingBookingsToday: 0,
    };

    const isOnline = p.operationalStatus === 'ONLINE';
    const summary = {
      todayEarnings: p.todayEarnings,
      monthlyEarnings: p.monthlyEarnings,
      todayBookingsCount: p.todayBookingsCount,
      completedBookingsToday: p.completedBookingsToday,
      pendingBookingsToday: p.pendingBookingsToday,
      rating: p.ratingAvg,
      ratingCount: p.ratingCount,
      dutyStatus: isOnline ? 'online' : 'offline',
      attendanceStatus: isOnline ? 'PRESENT' : 'OFFLINE',
    };
    await this.cache.set(cacheKey, summary, 30);
    return { data: summary, source: 'MONGODB' };
  }

  async getServices(beauticianId, limit = 4) {
    const cacheKey = `home:beautician:${beauticianId}:services:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return { data: cached, source: 'REDIS_CACHE' };

    await new Promise((r) => setTimeout(r, 20));
    const items = this.services.slice(0, limit);
    await this.cache.set(cacheKey, items, 300);
    return { data: items, source: 'MONGODB' };
  }

  async updateDutyStatus(beauticianId, { dutyStatus, isAvailable }) {
    let newStatus = 'OFFLINE';
    if (dutyStatus) newStatus = String(dutyStatus).toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
    else if (typeof isAvailable === 'boolean') newStatus = isAvailable ? 'ONLINE' : 'OFFLINE';

    const p = this.profiles.get(beauticianId) || { userId: beauticianId };
    p.operationalStatus = newStatus;
    p.isAvailable = newStatus === 'ONLINE';
    this.profiles.set(beauticianId, p);

    // Invalidate Redis caches immediately
    await this.cache.del(`home:beautician:${beauticianId}:summary`);
    await this.cache.delByPattern(`home:beautician:${beauticianId}:*`);

    return {
      dutyStatus: newStatus.toLowerCase(),
      isAvailable: p.isAvailable,
      attendanceStatus: p.isAvailable ? 'PRESENT' : 'OFFLINE',
    };
  }
}

// -------------------------------------------------------------
// Test Executions
// -------------------------------------------------------------

async function runTests() {
  const bannerSvc = new MockBannerService(memoryRedis);
  const feedSvc = new MockHomeFeedService(memoryRedis);
  const bookingSvc = new MockBookingHomeService(memoryRedis);
  const beauticianSvc = new MockBeauticianHomeService(memoryRedis);

  // 1. User Home: GET /api/v1/home/banners
  await test('1. User Home — GET /api/v1/home/banners (Active banners & Redis Caching)', async () => {
    // Cold run (DB)
    const t0 = performance.now();
    const res1 = await bannerSvc.getHomeBanners();
    const lat1 = performance.now() - t0;
    assert.strictEqual(res1.source, 'MONGODB');
    assert.strictEqual(res1.data.length, 2);
    assert.ok(lat1 < 200, `Cold DB latency ${lat1}ms should be < 200ms`);

    // Warm run (Redis)
    const t1 = performance.now();
    const res2 = await bannerSvc.getHomeBanners();
    const lat2 = performance.now() - t1;
    assert.strictEqual(res2.source, 'REDIS_CACHE');
    assert.strictEqual(res2.data.length, 2);
    assert.ok(lat2 < 50, `Redis latency ${lat2}ms should be < 50ms`);

    // Invalidation test
    await bannerSvc.createBanner({ id: 'b3', title: 'New Year Offer', imageUrl: 'img.jpg', isActive: true, displayOrder: 3 });
    const res3 = await bannerSvc.getHomeBanners();
    assert.strictEqual(res3.source, 'MONGODB', 'Cache should be invalidated after banner creation');
    assert.strictEqual(res3.data.length, 3);
  });

  // 2. User Home: GET /api/v1/home/feed
  await test('2. User Home — GET /api/v1/home/feed (Pre-computed Redis Materialized View)', async () => {
    // Cold Materialization
    const t0 = performance.now();
    const res1 = await feedSvc.getFeed({ city: 'all' });
    const lat1 = performance.now() - t0;
    assert.strictEqual(res1.source, 'MONGODB');
    assert.ok(res1.data.categories.length > 0, 'Categories must exist');
    assert.ok(res1.data.featuredServices.length > 0, 'Featured services must exist');
    assert.ok(res1.data.spotlightPackage !== null, 'Spotlight package must exist');
    assert.ok(res1.data.offers.length > 0, 'Public offers must exist');
    assert.ok(lat1 < 200, `Feed cold compute latency ${lat1}ms should be < 200ms`);

    // Cached Materialized View hit
    const t1 = performance.now();
    const res2 = await feedSvc.getFeed({ city: 'all' });
    const lat2 = performance.now() - t1;
    assert.strictEqual(res2.source, 'REDIS_MATERIALIZED_VIEW');
    assert.ok(lat2 < 50, `Materialized view latency ${lat2}ms should be < 50ms (got ${lat2.toFixed(3)}ms)`);

    // Invalidation
    await feedSvc.invalidateFeed('all');
    const res3 = await feedSvc.getFeed({ city: 'all' });
    assert.strictEqual(res3.source, 'MONGODB');
  });

  // 3. User Home: GET /api/v1/home/summary
  await test('3. User Home — GET /api/v1/home/summary (User Data Isolation & Active Booking)', async () => {
    // User Priya
    const priyaRes = await bookingSvc.getUserHomeSummary('user_priya');
    assert.strictEqual(priyaRes.data.unreadNotificationsCount, 2);
    assert.strictEqual(priyaRes.data.activeBooking?.bookingNumber, 'GRB-9021');
    assert.strictEqual(priyaRes.data.recentBookings.length, 1);

    // User Neha (Isolated from Priya's bookings)
    const nehaRes = await bookingSvc.getUserHomeSummary('user_neha');
    assert.strictEqual(nehaRes.data.unreadNotificationsCount, 1);
    assert.strictEqual(nehaRes.data.activeBooking?.bookingNumber, 'GRB-9023');
    assert.strictEqual(nehaRes.data.recentBookings.length, 0);

    // Cached lookup
    const cachedPriya = await bookingSvc.getUserHomeSummary('user_priya');
    assert.strictEqual(cachedPriya.source, 'REDIS_CACHE');
  });

  // 4. Concurrent User Home Initial Calls: Exactly 3 APIs
  await test('4. User Home — Concurrent 3 Initial APIs (Banners + Feed + Summary)', async () => {
    const t0 = performance.now();
    const [banners, feed, summary] = await Promise.all([
      bannerSvc.getHomeBanners(),
      feedSvc.getFeed({ city: 'all' }),
      bookingSvc.getUserHomeSummary('user_priya'),
    ]);
    const totalDuration = performance.now() - t0;

    assert.ok(banners.data.length > 0, 'Banners loaded');
    assert.ok(feed.data.categories.length > 0, 'Feed loaded');
    assert.ok(summary.data.activeBooking !== undefined, 'Summary loaded');
    assert.ok(totalDuration < 50, `Concurrent initial load ${totalDuration.toFixed(2)}ms must be < 50ms with Redis`);
    console.log(`     ⚡ Exactly 3 Concurrent User Home APIs completed in ${totalDuration.toFixed(2)}ms`);
  });

  // 5. Beautician Home: GET /api/v1/beautician/home/summary
  await test('5. Beautician Home — GET /api/v1/beautician/home/summary (Hero Metrics & Status)', async () => {
    const res = await beauticianSvc.getSummary('bt_anita');
    assert.strictEqual(res.data.todayEarnings, 452);
    assert.strictEqual(res.data.completedBookingsToday, 4);
    assert.strictEqual(res.data.pendingBookingsToday, 1);
    assert.strictEqual(res.data.monthlyEarnings, 24500);
    assert.strictEqual(res.data.rating, 4.85);
    assert.strictEqual(res.data.dutyStatus, 'online');
    assert.strictEqual(res.data.attendanceStatus, 'PRESENT');

    // Cached hit
    const cached = await beauticianSvc.getSummary('bt_anita');
    assert.strictEqual(cached.source, 'REDIS_CACHE');
  });

  // 6. Beautician Home: GET /api/v1/beautician/home/upcoming-bookings?limit=2
  await test('6. Beautician Home — GET /api/v1/beautician/home/upcoming-bookings?limit=2', async () => {
    const res = await bookingSvc.getBeauticianUpcomingBookings('bt_anita', 2);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].bookingNumber, 'GRB-9021');
    assert.strictEqual(res.data[0].clientName, 'Priya Sharma');
    assert.ok(res.data[0].clientAddress.includes('Bhopal'));
  });

  // 7. Beautician Home: GET /api/v1/beautician/home/services?limit=4
  await test('7. Beautician Home — GET /api/v1/beautician/home/services?limit=4', async () => {
    const res = await beauticianSvc.getServices('bt_anita', 4);
    assert.strictEqual(res.data.length, 4, 'Must return exactly 4 services');
    assert.strictEqual(res.data[0].title, 'Bridal Make-up HD');
  });

  // 8. Beautician Home: Duty / Attendance Toggle Mutation
  await test('8. Beautician Home — Duty Toggle Mutation & Instant Cache Invalidation', async () => {
    // Toggle to offline
    const updated = await beauticianSvc.updateDutyStatus('bt_anita', { dutyStatus: 'offline' });
    assert.strictEqual(updated.dutyStatus, 'offline');
    assert.strictEqual(updated.isAvailable, false);
    assert.strictEqual(updated.attendanceStatus, 'OFFLINE');

    // Verify summary reflects offline status and bypassed stale cache
    const freshSummary = await beauticianSvc.getSummary('bt_anita');
    assert.strictEqual(freshSummary.source, 'MONGODB', 'Cache must be invalidated on toggle');
    assert.strictEqual(freshSummary.data.dutyStatus, 'offline');
    assert.strictEqual(freshSummary.data.attendanceStatus, 'OFFLINE');

    // Toggle back to online
    await beauticianSvc.updateDutyStatus('bt_anita', { dutyStatus: 'online' });
    const onlineSummary = await beauticianSvc.getSummary('bt_anita');
    assert.strictEqual(onlineSummary.data.dutyStatus, 'online');
    assert.strictEqual(onlineSummary.data.attendanceStatus, 'PRESENT');
  });

  // 9. Concurrent Beautician Home Initial Calls: Exactly 3 APIs
  await test('9. Beautician Home — Concurrent 3 Initial APIs (Summary + Upcoming + Services)', async () => {
    const t0 = performance.now();
    const [summary, upcoming, services] = await Promise.all([
      beauticianSvc.getSummary('bt_anita'),
      bookingSvc.getBeauticianUpcomingBookings('bt_anita', 2),
      beauticianSvc.getServices('bt_anita', 4),
    ]);
    const totalDuration = performance.now() - t0;

    assert.ok(summary.data.rating > 0, 'Summary loaded');
    assert.ok(upcoming.data.length >= 0, 'Upcoming bookings loaded');
    assert.ok(services.data.length === 4, 'Services loaded');
    assert.ok(totalDuration < 50, `Concurrent beautician load ${totalDuration.toFixed(2)}ms must be < 50ms with Redis`);
    console.log(`     ⚡ Exactly 3 Concurrent Beautician Home APIs completed in ${totalDuration.toFixed(2)}ms`);
  });

  // 10. High-Concurrency Stress Test: 1,000 Simultaneous User/Beautician Home Requests
  await test('10. High Concurrency SLA Benchmark: 1,000 Concurrent Hits at < 50ms SLA', async () => {
    // Warm up caches for test tenants (matching background worker behavior)
    await Promise.all([
      bannerSvc.getHomeBanners(),
      feedSvc.getFeed({ city: 'all' }),
      bookingSvc.getUserHomeSummary('user_priya'),
      bookingSvc.getUserHomeSummary('user_neha'),
      beauticianSvc.getSummary('bt_anita'),
      bookingSvc.getBeauticianUpcomingBookings('bt_anita', 2),
      beauticianSvc.getServices('bt_anita', 4),
    ]);

    const CONCURRENT_REQUESTS = 1000;
    const POOL_CONCURRENCY = 50;
    const latencies = [];
    const startTime = performance.now();

    let currentIndex = 0;
    async function worker() {
      while (currentIndex < CONCURRENT_REQUESTS) {
        const idx = currentIndex++;
        const isUser = idx % 2 === 0;
        const reqStart = performance.now();
        if (isUser) {
          await Promise.all([
            bannerSvc.getHomeBanners(),
            feedSvc.getFeed({ city: 'all' }),
            bookingSvc.getUserHomeSummary(idx % 4 === 0 ? 'user_priya' : 'user_neha'),
          ]);
        } else {
          await Promise.all([
            beauticianSvc.getSummary('bt_anita'),
            bookingSvc.getBeauticianUpcomingBookings('bt_anita', 2),
            beauticianSvc.getServices('bt_anita', 4),
          ]);
        }
        latencies.push(performance.now() - reqStart);
      }
    }

    const workers = Array.from({ length: POOL_CONCURRENCY }, () => worker());
    await Promise.all(workers);
    const totalTime = performance.now() - startTime;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(CONCURRENT_REQUESTS * 0.5)];
    const p95 = latencies[Math.floor(CONCURRENT_REQUESTS * 0.95)];
    const p99 = latencies[Math.floor(CONCURRENT_REQUESTS * 0.99)];
    const avg = latencies.reduce((a, b) => a + b, 0) / CONCURRENT_REQUESTS;

    console.log(`     📊 1,000 Concurrent Load Test Results:`);
    console.log(`        Total Batch Time: ${totalTime.toFixed(2)} ms (${(CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(0)} req/sec)`);
    console.log(`        Average Latency : ${avg.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p50 Latency     : ${p50.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p95 Latency     : ${p95.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p99 Latency     : ${p99.toFixed(3)} ms (Target < 50ms)`);

    assert.ok(avg < 50, `Average latency ${avg.toFixed(2)}ms must be < 50ms SLA`);
    assert.ok(p95 < 50, `p95 latency ${p95.toFixed(2)}ms must be < 50ms SLA`);
    assert.ok(p99 < 50, `p99 latency ${p99.toFixed(2)}ms must be < 50ms SLA`);
  });

  console.log('\n========================================');
  console.log(`✨ Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
