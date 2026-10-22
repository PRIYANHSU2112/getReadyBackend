import fs from 'fs';
import { openapiSpec } from 'file:///c:/projects/GR/Backend/services/api-gateway/src/docs/openapi.js';

function getServiceName(p) {
  if (p.startsWith('/api/v1/auth')) return 'Auth Service';
  if (p.startsWith('/api/v1/users') || p.startsWith('/api/v1/addresses') || p.startsWith('/api/v1/members') || p.startsWith('/api/v1/roles') || p.startsWith('/api/v1/permissions') || p.startsWith('/api/v1/referrals') || p.startsWith('/api/v1/customer-profiles')) return 'User Service';
  if (p.startsWith('/api/v1/beautician-profiles') || p.startsWith('/api/v1/beauticians') || p.startsWith('/api/v1/bank-details') || p.startsWith('/api/v1/skills') || p.startsWith('/api/v1/beautician/home')) return 'Beautician Service';
  if (p.startsWith('/api/v1/categories') || p.startsWith('/api/v1/services') || p.startsWith('/api/v1/service-change-requests') || p.startsWith('/api/v1/packages') || p.startsWith('/api/v1/filters') || p.startsWith('/api/v1/hygiene-kits') || p.startsWith('/api/v1/coupons') || p.startsWith('/api/v1/offers') || p.startsWith('/api/v1/admin/promotions') || p === '/api/v1/home/feed') return 'Catalog Service';
  if (p.startsWith('/api/v1/slots') || p.startsWith('/api/v1/bookings') || p.startsWith('/api/v1/calendar') || p.startsWith('/admin/calendar') || p.startsWith('/admin/bookings') || p.startsWith('/api/v1/reports') || p.startsWith('/api/v1/settings') || p === '/api/v1/home/summary' || p === '/api/v1/beautician/home/upcoming-bookings') return 'Booking & Calendar Service';
  if (p.startsWith('/api/v1/cart')) return 'Cart Service';
  if (p.startsWith('/api/v1/payments') || p.startsWith('/api/v1/finance')) return 'Payment Service';
  if (p.startsWith('/api/v1/wallet') || p.startsWith('/api/v1/wallets') || p.startsWith('/api/v1/beautician/wallet') || p.startsWith('/api/v1/admin/payouts')) return 'Wallet Service';
  if (p.startsWith('/api/v1/notifications')) return 'Notification Service';
  if (p.startsWith('/api/v1/banners') || p.startsWith('/api/v1/marketing') || p.startsWith('/api/v1/blogs') || p.startsWith('/api/v1/support') || p.startsWith('/api/v1/tickets') || p.startsWith('/api/v1/reviews') || p.startsWith('/api/v1/cms') || p.startsWith('/api/v1/content') || p.startsWith('/api/v1/landing') || p.startsWith('/api/v1/faq') || p === '/api/v1/home/banners') return 'Content Service';
  if (p.startsWith('/api/v1/memberships') || p.startsWith('/api/v1/admin/memberships')) return 'Membership Service';
  if (p.startsWith('/api/v1/search')) return 'Search Service';
  return 'API Gateway & Core System';
}

const masterApis = [];
const seenKey = new Set();

// 1. Ingest all from OpenAPI spec
for (const [routePath, methods] of Object.entries(openapiSpec.paths)) {
  for (const [httpMethod, op] of Object.entries(methods)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(httpMethod.toLowerCase())) continue;
    const method = httpMethod.toUpperCase();
    const key = `${method} ${routePath}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    const tag = (op.tags && op.tags[0]) || 'General';
    const serviceName = getServiceName(routePath);

    const queryParams = [];
    const pathParams = [];
    if (op.parameters) {
      for (const param of op.parameters) {
        if (param.in === 'query') queryParams.push(param.name + (param.required ? '*' : ''));
        if (param.in === 'path') pathParams.push(param.name);
      }
    }

    let auth = 'None (Public)';
    if (op.security && op.security.length > 0) {
      auth = Object.keys(op.security[0]).join(', ');
    } else if (tag === 'User') {
      auth = 'Bearer JWT (Customer)';
    } else if (tag === 'Beautician') {
      auth = 'Bearer JWT (Beautician)';
    } else if (tag === 'Admin') {
      auth = 'Bearer JWT (Admin/SuperAdmin)';
    }

    masterApis.push({
      serviceName,
      endpoint: routePath,
      method,
      description: op.summary || op.description || `${method} ${routePath}`,
      tag,
      queryParams: queryParams.join(', ') || 'None',
      pathParams: pathParams.join(', ') || 'None',
      requestBody: op.requestBody ? 'JSON schema defined' : 'None',
      auth,
      source: 'OpenAPI Spec'
    });
  }
}

// 2. Additional Core System / Gateway endpoints
const gatewayExtras = [
  { serviceName: 'API Gateway & Core System', endpoint: '/health', method: 'GET', description: 'API Gateway Liveness Probe', auth: 'None (Public)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/ready', method: 'GET', description: 'API Gateway Readiness Probe', auth: 'None (Public)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/metrics', method: 'GET', description: 'Prometheus Metrics Exposition Endpoint', auth: 'None (Public)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/health/system', method: 'GET', description: 'Full System Health Aggregator for Admin Dashboard', auth: 'None (Public)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/api/v1/system/health', method: 'GET', description: 'API v1 System Health Aggregator', auth: 'None (Public)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/api/v1/uploads/presign', method: 'POST', description: 'Generate Presigned S3/Object Storage Upload URL', auth: 'Bearer JWT (Any Role)' },
  { serviceName: 'API Gateway & Core System', endpoint: '/api-docs.json', method: 'GET', description: 'Raw OpenAPI Specification JSON', auth: 'None (Public)' }
];

for (const extra of gatewayExtras) {
  const key = `${extra.method} ${extra.endpoint}`;
  if (!seenKey.has(key)) {
    seenKey.add(key);
    masterApis.push({
      ...extra,
      tag: 'System',
      queryParams: 'None',
      pathParams: 'None',
      requestBody: extra.method === 'POST' ? 'JSON schema defined' : 'None',
      source: 'Gateway Routes'
    });
  }
}

// 3. Additional microservice internal / helper routes discovered from code
const codeExtras = [
  { serviceName: 'User Service', endpoint: '/api/v1/users/internal/auth-lookup-email', method: 'POST', description: 'Internal Service IPC: Lookup user by email for Auth Service', auth: 'Internal Service Secret' },
  { serviceName: 'User Service', endpoint: '/api/v1/users/internal/find-or-create-mobile', method: 'POST', description: 'Internal Service IPC: Find or register customer by mobile OTP', auth: 'Internal Service Secret' },
  { serviceName: 'User Service', endpoint: '/api/v1/users/internal/:id/last-login', method: 'PATCH', description: 'Internal Service IPC: Update user last login timestamp', auth: 'Internal Service Secret' },
  { serviceName: 'User Service', endpoint: '/api/v1/users/internal/set-password-by-email', method: 'PATCH', description: 'Internal Service IPC: Update password after reset', auth: 'Internal Service Secret' },
  { serviceName: 'Catalog Service', endpoint: '/api/v1/home/feed/refresh', method: 'POST', description: 'Admin / Event: Force invalidate & pre-warm Redis home feed materialized view', auth: 'Bearer JWT (Admin)' },
  { serviceName: 'Booking & Calendar Service', endpoint: '/admin/calendar', method: 'GET', description: 'Admin Web Portal: Multi-beautician aggregate calendar view', auth: 'Bearer JWT (Admin)' },
  { serviceName: 'Booking & Calendar Service', endpoint: '/admin/bookings', method: 'GET', description: 'Admin Web Portal: Enterprise booking management listing', auth: 'Bearer JWT (Admin)' }
];

for (const extra of codeExtras) {
  const key = `${extra.method} ${extra.endpoint}`;
  if (!seenKey.has(key)) {
    seenKey.add(key);
    masterApis.push({
      ...extra,
      tag: 'Code Internal',
      queryParams: 'None',
      pathParams: extra.endpoint.includes(':') ? 'id' : 'None',
      requestBody: extra.method === 'POST' || extra.method === 'PATCH' ? 'JSON schema defined' : 'None',
      source: 'Code Route Definitions'
    });
  }
}

console.log('Master API catalog count:', masterApis.length);

const byService = {};
for (const item of masterApis) {
  byService[item.serviceName] = (byService[item.serviceName] || 0) + 1;
}
console.log('Final Breakdown per Microservice:');
console.log(JSON.stringify(byService, null, 2));

fs.writeFileSync('c:/projects/GR/Backend/scripts/master_api_inventory.json', JSON.stringify(masterApis, null, 2));
console.log('Saved to c:/projects/GR/Backend/scripts/master_api_inventory.json');
