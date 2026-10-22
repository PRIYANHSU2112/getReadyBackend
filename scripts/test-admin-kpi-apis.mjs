process.env.LOG_LEVEL = 'silent';
import 'express-async-errors';
import fs from 'fs';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { performance } from 'node:perf_hooks';

dotenv.config({ path: '.env.development' });
process.env.LOG_LEVEL = 'silent';

import { createApp as createUserApp } from '../services/user-service/src/app.js';
import { createApp as createBeauticianApp } from '../services/beautician-service/src/app.js';
import { createApp as createCatalogApp } from '../services/catalog-service/src/app.js';
import { createApp as createContentApp } from '../services/content-service/src/app.js';
import { createApp as createBookingApp } from '../services/booking-service/src/app.js';

const localMongoUri = 'mongodb://127.0.0.1:27017/getready_dev';
const jwtSecret = process.env.JWT_SECRET || 'getready_dev_super_secret_jwt_key_2026_at_least_32_characters';

console.log('========================================================================');
console.log('🧪 Automated API Testing: Admin KPI Stats Endpoints');
console.log('========================================================================\n');

// 1. Connect MongoDB
try {
  await mongoose.connect(localMongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ Connected to Local MongoDB:', localMongoUri);
} catch (err) {
  console.log('⚠️ Local connection failed, trying fallback:', err.message);
  try {
    await mongoose.connect(process.env.DATABASE_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to fallback database.');
  } catch (err2) {
    console.error('❌ Database connection failed:', err2.message);
    process.exit(1);
  }
}

// 2. Generate Super Admin Token & Mock Headers
const adminToken = jwt.sign(
  { sub: '65f1a1a1a1a1a1a1a1a1a101', id: '65f1a1a1a1a1a1a1a1a1a101', role: 'super_admin', email: 'admin@getready.com' },
  jwtSecret,
  { expiresIn: '1d' }
);

function extractApp(result) {
  return result && result.app ? result.app : result;
}

// 3. Instantiate apps
const userApp = extractApp(createUserApp());
const beauticianApp = extractApp(createBeauticianApp());
const catalogApp = extractApp(createCatalogApp());
const contentApp = extractApp(createContentApp());
const bookingApp = extractApp(createBookingApp());

const testSuites = [
  {
    name: '1. User Service - Customer KPI Stats',
    app: userApp,
    endpoint: '/api/v1/users/admin/stats',
    description: 'Returns total, active, blocked, and verified customer counts via $facet'
  },
  {
    name: '2. User Service - Customer KPI Stats (Period Filter = month)',
    app: userApp,
    endpoint: '/api/v1/users/admin/stats?period=month',
    description: 'Returns customer stats filtered by last 30 days'
  },
  {
    name: '3. Beautician Service - Partner KPI Stats',
    app: beauticianApp,
    endpoint: '/api/v1/beautician-profiles/admin/stats',
    description: 'Returns total, active, available, busy, offline, and KYC status metrics via $facet'
  },
  {
    name: '4. Beautician Service - Partner KPI Stats (Period Filter = week)',
    app: beauticianApp,
    endpoint: '/api/v1/beautician-profiles/admin/stats?period=week',
    description: 'Returns beautician stats onboarded in last 7 days'
  },
  {
    name: '5. Catalog Service - Services KPI Stats',
    app: catalogApp,
    endpoint: '/api/v1/services/admin/stats',
    description: 'Returns total services, live/approved, pending approval, and price distribution'
  },
  {
    name: '6. Catalog Service - Categories KPI Stats',
    app: catalogApp,
    endpoint: '/api/v1/categories/admin/stats',
    description: 'Returns total categories, active, inactive, and total mapped services count'
  },
  {
    name: '7. Catalog Service - Packages KPI Stats',
    app: catalogApp,
    endpoint: '/api/v1/packages/admin/stats',
    description: 'Returns total packages, pending approval, approved, and beautician-created bundles'
  },
  {
    name: '8. Catalog Service - Coupons KPI Stats',
    app: catalogApp,
    endpoint: '/api/v1/coupons/admin/stats',
    description: 'Returns total coupons, active, total redemption count, and expired promos'
  },
  {
    name: '9. Content Service - Reviews KPI Stats',
    app: contentApp,
    endpoint: '/api/v1/reviews/admin/stats',
    description: 'Returns total reviews, average rating score, 5-star count, and pending moderation queue'
  },
  {
    name: '10. Content Service - Support / Tickets KPI Stats',
    app: contentApp,
    endpoint: '/api/v1/tickets/admin/stats',
    description: 'Returns total support tickets, open, in-progress, resolved, and urgent priority counts'
  },
  {
    name: '11. Content Service - Banners KPI Stats',
    app: contentApp,
    endpoint: '/api/v1/banners/admin/stats',
    description: 'Returns total marketing banners, active, deeplinked, and currently live in schedule'
  },
  {
    name: '12. Booking Service - Bookings KPI Stats',
    app: bookingApp,
    endpoint: '/api/v1/bookings/admin/stats',
    description: 'Returns total bookings, completed, revenue, and dispatch assignments via analytics aggregator'
  }
];

const results = [];

for (const t of testSuites) {
  const start = performance.now();
  let res;
  let error = null;

  try {
    res = await request(t.app)
      .get(t.endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-user-id', '65f1a1a1a1a1a1a1a1a1a101')
      .set('x-user-role', 'super_admin');
  } catch (e) {
    error = e.message;
  }

  const durationMs = Math.round((performance.now() - start) * 10) / 10;
  const status = res ? res.status : 500;
  const success = status >= 200 && status < 300;

  results.push({
    name: t.name,
    endpoint: t.endpoint,
    description: t.description,
    status,
    success,
    durationMs,
    body: res ? res.body : { error },
  });

  const icon = success ? '✅' : '❌';
  console.log(`${icon} [${status}] ${t.name}`);
  console.log(`   Endpoint: ${t.endpoint}`);
  console.log(`   Latency:  ${durationMs} ms (Target < 200 ms)`);
  console.log(`   Response:`, JSON.stringify(res ? res.body : { error }, null, 2));
  console.log('------------------------------------------------------------------------\n');
}

console.log('========================================================================');
console.log('📊 Test Execution Summary:');
console.log(`   Total Tests:  ${results.length}`);
console.log(`   Passed:       ${results.filter(r => r.success).length}`);
console.log(`   Failed:       ${results.filter(r => !r.success).length}`);
const avgDuration = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length);
console.log(`   Avg Latency:  ${avgDuration} ms`);
console.log('========================================================================');

try {
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/admin_kpi_test_results.json', JSON.stringify(results, null, 2));
  console.log('📁 Detailed JSON report saved to: reports/admin_kpi_test_results.json\n');
} catch (_) {}

await mongoose.disconnect();
process.exit(results.every(r => r.success) ? 0 : 1);
