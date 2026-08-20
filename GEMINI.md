# 🏛️ Salon Backend - Master Engineering & Optimization Standards

This document is the **Single Source of Truth** for architectural patterns, coding guidelines, performance optimizations, database practices, and security rules for this repository. Every developer and AI agent must strictly follow these standards for all new features and refactors.

---

## 🏗️ 1. Architecture: Modular MVRSC with Pure Dependency Injection (DI)

Every feature lives in its dedicated folder under `src/modules/<feature-name>/` with strict separation of concerns:

```text
src/modules/<feature-name>/
├── <feature>.model.js          # Mongoose schema, indexes, hooks (Zero business logic)
├── <feature>.repository.js     # Data Access Layer extending BaseRepository (DB queries & aggregations)
├── <feature>.service.js        # Core business logic & caching extending BaseService (No req/res)
├── <feature>.controller.js     # HTTP request handling & status codes extending BaseController
├── <feature>.validation.js     # Joi validation schemas extending BaseValidator
├── <feature>.mapper.js         # DTO mappers stripping internal Mongoose metadata
├── <feature>.routes.js         # Express router guarded by auth & RBAC middlewares
├── <feature>.docs.js           # OpenAPI 3.0.3 Swagger specification
└── index.js                    # Module Factory Function (create<Feature>Module)
```

### 💉 Pure Constructor Dependency Injection (DI) Rules:
- **No Class Instantiations Inside Classes:** Never use `new ForeignService()` or `new ForeignRepository()` inside a service or controller.
- **Constructor Injection:** Always pass repository, service, cache, and storage dependencies via class constructors.
- **Factory Assembly:** Every module's `index.js` exports a `create<Feature>Module(deps)` factory that instantiates and wires its layers.
- **Composition Root:** All cross-module dependencies and interfaces are wired in [`src/routes/index.js`](file:///src/routes/index.js) without circular dependencies.

---

## ⚡ 2. Async Execution & Promise Concurrency Optimization

- **Never Use Sequential `await` for Independent Tasks:**
  ```javascript
  // ❌ BAD - Sequential bottleneck (takes 2x time)
  const cartDoc = await this.cartRepository.findDocumentByUserId(userId);
  const recipient = await this.memberRepository.findById(memberId);

  // ✅ GOOD - Parallel execution (takes 1x time)
  const [cartDoc, recipient] = await Promise.all([
    this.cartRepository.findDocumentByUserId(userId),
    this.memberRepository.findById(memberId),
  ]);
  ```
- **Parallelize Array/Batch Operations:**
  Never run `for (const item of items) { await doWork(item); }`. Always use `await Promise.all(items.map(async (item) => doWork(item)))`.
- **Sequential `await` ONLY for Hard Dependencies:**
  Use sequential `await` strictly when Step B requires the output or validation result of Step A.
- **ACID Transactions for Critical Flows:**
  Financial mutations (Wallet debits/credits, Booking confirmations, Payment webhooks) must use `#runInSession(async (session) => { ... })`.

---

## 🗄️ 3. High-Performance MongoDB & Aggregation Pipelines

### 📊 Single-Roundtrip Aggregation with `$facet`:
For all paginated lists with search and filters, use a single MongoDB Aggregation Pipeline using `$facet` to return items and total count simultaneously:

```javascript
const pipeline = [
  { $match: matchStage },
  {
    $facet: {
      items: [
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit },
        // Optional projection / lookup
      ],
      totalCount: [
        { $count: 'count' },
      ],
    },
  },
];
const [result] = await this.model.aggregate(pipeline).exec();
const items = result.items || [];
const total = result.totalCount[0]?.count || 0;
```

### 🔍 Search & Filtering Best Practices:
- **Case-Insensitive Regex / Text Search:** Use trimmed search terms with sanitized regex: `{ $regex: escapeRegex(search), $options: 'i' }`.
- **Range & Status Filtering:** Combine dynamic conditions into a single `$match` object:
  ```javascript
  if (query.status) match.status = query.status;
  if (query.minPrice || query.maxPrice) {
    match.price = {};
    if (query.minPrice) match.price.$gte = Number(query.minPrice);
    if (query.maxPrice) match.price.$lte = Number(query.maxPrice);
  }
  ```
- **Compound Indexes:** Always define compound indexes in `*.model.js` matching frequent query + sort patterns (e.g. `{ status: 1, isDefault: 1, sortOrder: 1 }`).
- **No N+1 Queries:** Never query inside a loop. Use `$in` operator or aggregate `$lookup`.
- **Lean DTOs:** Strip Mongoose overhead using `.lean()` or mapper DTO transforms (`to<Entity>Dto`).

---

## 🚀 4. Multi-Tier Caching & Ultra-Fast API Responses

1. **Multi-Tier Architecture:**
   - **L1 Cache (In-Memory Process TTL):** `TtlMemoryCache` for lightning-fast microsecond responses on ultra-hot read endpoints.
   - **L2 Cache (Redis Cluster):** Distributed `CacheService` with standardized TTLs (e.g., 300s for dynamic carts/wallets, 600s for catalogs/rules).
2. **Standardized Cache Keys:**
   - Generate keys using `this.cacheKey(domain, entity, id, ...params)` (e.g. `salon:wallet:user:<userId>`, `salon:loyalty:rules`).
3. **Immediate Cache Invalidation on Mutations:**
   - Whenever an entity is created, updated, soft-deleted, or toggled, immediately call `this.invalidateCache(key)` or pattern invalidation (`delByPattern`).

---

## 📄 5. Standardized Pagination & List Query Helpers

All listing endpoints must support standard query parameters using `parseListQuery` and `buildPaginationMeta`:

```javascript
// Service Layer
async list(query = {}) {
  const pagination = parseListQuery(query, {
    allowedSortFields: ['createdAt', 'price', 'name', 'sortOrder'],
    defaultSort: { createdAt: -1 },
    defaultLimit: 10,
    maxLimit: 100,
  });

  const { items, total } = await this.repository.listWithAggregation(query, pagination);

  return {
    items: items.map(toEntityDto),
    meta: buildPaginationMeta(total, pagination),
  };
}
```

---

## 🛡️ 6. Validation, Security & Zero-Trust Pricing

1. **Strict Joi Schemas (`.unknown(false)`):**
   - Every route input (`body`, `query`, `params`) must be validated using Joi schemas that reject unexpected properties.
2. **Zero-Trust Pricing (Backend-Only Calculations):**
   - **Clients must never supply prices, discounts, or subtotals.**
   - Clients send only `{ refId, itemType, quantity }`.
   - The backend pricing engine fetches live database prices and computes items subtotal, hygiene kit total, discounts, taxes, and grand total.
3. **RBAC & Permission Registry:**
   - Every guarded endpoint must have its permission key registered in [`src/common/permissions/permission.registry.js`](file:///src/common/permissions/permission.registry.js) and protected with `guards.checkPermission`.
4. **Ownership Verification:**
   - Users can only access/modify their own resources (`req.user.id === resource.userId`). Super Admin bypasses ownership.

---

## 📦 7. Standardized API Response Envelopes & Error Handling

All controller responses must use standard `BaseController` methods:

```json
// Success Response (200 OK / 201 Created)
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}

// Standard Error Response (4xx / 5xx)
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Hygiene kit count must be between 1 and 20",
    "details": [...]
  }
}
```

---

## 📖 8. OpenAPI / Swagger Documentation Standards

- Every route added or updated must be documented in `*.docs.js` under `paths: { '/api/v1/<resource>': { ... } }`.
- Include request body schemas, parameters, sample payloads, and response schemas with example DTOs.
- Register every module's docs in [`src/core/swagger/docs.registry.js`](file:///src/core/swagger/docs.registry.js).
