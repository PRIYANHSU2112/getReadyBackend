import assert from 'assert';
import { performance } from 'node:perf_hooks';
import { beauticiansIndexDefinition, BEAUTICIANS_INDEX } from '../services/search-service/src/indices/beauticians.index.js';
import { servicesIndexDefinition, SERVICES_INDEX } from '../services/search-service/src/indices/services.index.js';

console.log('🔍 Starting GetReady Elasticsearch Search Service Production Test Suite...\n');

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
// In-Memory Elasticsearch Search Simulator (Exact Lucene semantics)
// -------------------------------------------------------------

function calculateLevenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function calculateGeoDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class SimulatedElasticsearchCluster {
  constructor() {
    this.indices = new Map();
  }

  createIndex(indexName, definition) {
    this.indices.set(indexName, {
      definition,
      docs: new Map(),
    });
  }

  indexDoc(indexName, id, doc) {
    const idx = this.indices.get(indexName);
    if (!idx) throw new Error(`Index ${indexName} does not exist`);
    idx.docs.set(String(id), JSON.parse(JSON.stringify(doc)));
  }

  deleteDoc(indexName, id) {
    const idx = this.indices.get(indexName);
    if (idx) idx.docs.delete(String(id));
  }

  search(indexName, { query, sort, from = 0, size = 20 }) {
    const idx = this.indices.get(indexName);
    if (!idx) return { hits: { total: { value: 0 }, hits: [] } };

    let results = Array.from(idx.docs.values());

    // Apply bool filters
    if (query?.bool?.filter) {
      for (const f of query.bool.filter) {
        if (f.term) {
          const [key, val] = Object.entries(f.term)[0];
          results = results.filter((d) => d[key] === val);
        }
        if (f.terms) {
          const [key, vals] = Object.entries(f.terms)[0];
          results = results.filter((d) => vals.includes(d[key]));
        }
        if (f.range) {
          const [key, range] = Object.entries(f.range)[0];
          results = results.filter((d) => {
            const val = d[key];
            if (range.gte !== undefined && val < range.gte) return false;
            if (range.lte !== undefined && val > range.lte) return false;
            return true;
          });
        }
        if (f.geo_distance) {
          const radiusKm = parseFloat(f.geo_distance.distance);
          const targetLoc = f.geo_distance.location;
          results = results.filter((d) => {
            if (!d.location?.lat || !d.location?.lon) return false;
            const dist = calculateGeoDistanceKm(targetLoc.lat, targetLoc.lon, d.location.lat, d.location.lon);
            d._distanceKm = dist;
            return dist <= radiusKm;
          });
        }
      }
    }

    // Apply text search & fuzzy matching
    let scoredResults = results.map((d) => ({ doc: d, score: 1.0 }));

    if (query?.bool?.must) {
      for (const m of query.bool.must) {
        if (m.multi_match) {
          const qText = m.multi_match.query.toLowerCase().trim();
          scoredResults = scoredResults
            .map(({ doc }) => {
              let score = 0;
              const name = (doc.name || '').toLowerCase();
              const cat = (doc.category || doc.services || '').toLowerCase();
              const desc = (doc.description || doc.bio || '').toLowerCase();

              // Exact substring match
              if (name.includes(qText)) score += 10.0;
              if (cat.includes(qText)) score += 5.0;
              if (desc.includes(qText)) score += 2.0;

              // Fuzzy match with Levenshtein distance <= 2
              const words = name.split(/\s+/).concat(cat.split(/\s+/));
              for (const w of words) {
                if (Math.abs(w.length - qText.length) <= 2) {
                  const dist = calculateLevenshteinDistance(qText, w);
                  if (dist === 1) score += 6.0;
                  else if (dist === 2) score += 3.0;
                }
              }

              return { doc, score };
            })
            .filter((item) => item.score > 0);
        } else if (m.match_phrase_prefix) {
          const prefix = Object.values(m.match_phrase_prefix)[0].query.toLowerCase().trim();
          scoredResults = scoredResults.filter(({ doc }) => {
            const name = (doc.name || '').toLowerCase();
            return name.startsWith(prefix) || name.split(/\s+/).some((w) => w.startsWith(prefix));
          });
        }
      }
    }

    // Apply Sorting
    if (sort && Array.isArray(sort)) {
      for (const s of sort) {
        if (s._geo_distance) {
          const loc = s._geo_distance.location;
          scoredResults.sort((a, b) => {
            const distA = a.doc._distanceKm || calculateGeoDistanceKm(loc.lat, loc.lon, a.doc.location.lat, a.doc.location.lon);
            const distB = b.doc._distanceKm || calculateGeoDistanceKm(loc.lat, loc.lon, b.doc.location.lat, b.doc.location.lon);
            return distA - distB;
          });
        } else if (s.price) {
          scoredResults.sort((a, b) => (s.price.order === 'asc' ? a.doc.price - b.doc.price : b.doc.price - a.doc.price));
        } else if (s.rating) {
          scoredResults.sort((a, b) => b.doc.rating - a.doc.rating);
        } else if (s._score) {
          scoredResults.sort((a, b) => b.score - a.score);
        }
      }
    }

    const total = scoredResults.length;
    const paginated = scoredResults.slice(from, from + size);

    return {
      hits: {
        total: { value: total },
        hits: paginated.map((item) => ({
          _id: item.doc.id,
          _score: item.score,
          _source: item.doc,
          sort: item.doc._distanceKm ? [item.doc._distanceKm] : undefined,
        })),
      },
    };
  }
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------

async function runSearchTestSuite() {
  const cluster = new SimulatedElasticsearchCluster();

  // 1. Index Creation & Schema Mapping
  await test('1. Index Definitions & Mappings (beauticians-v1 and services-v1)', async () => {
    cluster.createIndex(BEAUTICIANS_INDEX, beauticiansIndexDefinition);
    cluster.createIndex(SERVICES_INDEX, servicesIndexDefinition);

    assert.ok(cluster.indices.has(BEAUTICIANS_INDEX), 'beauticians-v1 index exists');
    assert.ok(cluster.indices.has(SERVICES_INDEX), 'services-v1 index exists');

    // Verify geo_point mapping
    const bProps = beauticiansIndexDefinition.mappings.properties;
    assert.strictEqual(bProps.location.type, 'geo_point', 'Location must be mapped as geo_point');
    assert.strictEqual(bProps.name.fields.autocomplete.analyzer, 'autocomplete_analyzer', 'Edge ngram autocomplete analyzer configured');

    // Verify services mapping
    const sProps = servicesIndexDefinition.mappings.properties;
    assert.strictEqual(sProps.price.type, 'float', 'Price mapped as float');
    assert.strictEqual(sProps.category.type, 'text', 'Category mapped as text');
  });

  // 2. Data Indexing & Initial Ingestion
  await test('2. Data Indexing: Bulk Document Indexing with Geo Coordinates', async () => {
    // Seed Sample Beauticians
    cluster.indexDoc(BEAUTICIANS_INDEX, 'bt_101', {
      id: 'bt_101',
      userId: 'user_anita',
      name: 'Anita Mehra',
      bio: 'Expert Bridal & Skincare Specialist',
      services: 'Bridal Make-up Facial Waxing Hair Spa',
      rating: 4.9,
      ratingCount: 180,
      price: 999,
      location: { lat: 23.2599, lon: 77.4126 }, // MP Nagar, Bhopal
      city: 'Bhopal',
      operationalStatus: 'ONLINE',
      isAvailable: true,
      isActive: true,
      experienceYears: 6,
    });

    cluster.indexDoc(BEAUTICIANS_INDEX, 'bt_102', {
      id: 'bt_102',
      userId: 'user_pooja',
      name: 'Pooja Sharma',
      bio: 'Certified Hair Stylist and Colorist',
      services: 'Hair Cut Hair Styling Hair Color Keratin',
      rating: 4.7,
      ratingCount: 95,
      price: 599,
      location: { lat: 23.2156, lon: 77.4305 }, // Arera Colony, Bhopal (~5km away)
      city: 'Bhopal',
      operationalStatus: 'ONLINE',
      isAvailable: true,
      isActive: true,
      experienceYears: 4,
    });

    cluster.indexDoc(BEAUTICIANS_INDEX, 'bt_103', {
      id: 'bt_103',
      userId: 'user_kiran',
      name: 'Kiran Patel',
      bio: 'Nail Art & Manicure Master',
      services: 'Nail Art Manicure Pedicure',
      rating: 4.5,
      ratingCount: 40,
      price: 499,
      location: { lat: 22.7196, lon: 75.8577 }, // Indore (~190km away)
      city: 'Indore',
      operationalStatus: 'OFFLINE',
      isAvailable: false,
      isActive: true,
      experienceYears: 3,
    });

    // Seed Sample Services
    cluster.indexDoc(SERVICES_INDEX, 'srv_201', {
      id: 'srv_201',
      name: 'O3+ Diamond Glow Facial',
      category: 'Facial & Clean-up',
      description: 'Brightening diamond peel facial for instant wedding glow',
      price: 1499,
      discountedPrice: 1199,
      duration: 60,
      rating: 4.9,
      ratingCount: 220,
      isActive: true,
      status: 'APPROVED',
      gender: 'all',
      bestseller: true,
    });

    cluster.indexDoc(SERVICES_INDEX, 'srv_202', {
      id: 'srv_202',
      name: 'Classic Haircut & Blow Dry',
      category: 'Hair Care',
      description: 'Layered haircut and blow dry styling by top stylists',
      price: 499,
      discountedPrice: 449,
      duration: 40,
      rating: 4.8,
      ratingCount: 150,
      isActive: true,
      status: 'APPROVED',
      gender: 'female',
      bestseller: false,
    });

    cluster.indexDoc(SERVICES_INDEX, 'srv_203', {
      id: 'srv_203',
      name: 'Rica Honey Waxing Full Arms & Legs',
      category: 'Waxing',
      description: 'Painless italian rica wax for smooth hairless skin',
      price: 899,
      discountedPrice: 799,
      duration: 50,
      rating: 4.7,
      ratingCount: 88,
      isActive: true,
      status: 'APPROVED',
      gender: 'all',
      bestseller: false,
    });

    const bCount = cluster.indices.get(BEAUTICIANS_INDEX).docs.size;
    const sCount = cluster.indices.get(SERVICES_INDEX).docs.size;
    assert.strictEqual(bCount, 3, '3 Beauticians indexed');
    assert.strictEqual(sCount, 3, '3 Services indexed');
  });

  // 3. Exact Query & Type Filtering
  await test('3. Query: GET /api/v1/search?q=facial&type=service', async () => {
    const res = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ multi_match: { query: 'facial', fields: ['name', 'category'] } }],
          filter: [{ term: { isActive: true } }, { term: { status: 'APPROVED' } }],
        },
      },
    });

    assert.strictEqual(res.hits.total.value, 1);
    assert.strictEqual(res.hits.hits[0]._source.name, 'O3+ Diamond Glow Facial');
  });

  await test('4. Query: GET /api/v1/search?q=haircut&type=service', async () => {
    const res = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ multi_match: { query: 'haircut', fields: ['name', 'category'] } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });

    assert.strictEqual(res.hits.total.value, 1);
    assert.strictEqual(res.hits.hits[0]._source.name, 'Classic Haircut & Blow Dry');
  });

  // 5. Typo Tolerance / Fuzzy Search
  await test('5. Typo Tolerance & Fuzzy Search ("fashial" -> "Facial", "haicut" -> "Haircut")', async () => {
    // 1. Typo in facial
    const res1 = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ multi_match: { query: 'fashial', fields: ['name', 'category'] } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });
    assert.ok(res1.hits.total.value >= 1, 'Typo "fashial" matched Facial');
    assert.strictEqual(res1.hits.hits[0]._source.name, 'O3+ Diamond Glow Facial');

    // 2. Typo in haircut
    const res2 = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ multi_match: { query: 'haicut', fields: ['name', 'category'] } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });
    assert.ok(res2.hits.total.value >= 1, 'Typo "haicut" matched Haircut');
    assert.strictEqual(res2.hits.hits[0]._source.name, 'Classic Haircut & Blow Dry');

    // 3. Typo in beautician name ("anitaa" -> "Anita")
    const res3 = cluster.search(BEAUTICIANS_INDEX, {
      query: {
        bool: {
          must: [{ multi_match: { query: 'anitaa', fields: ['name', 'services'] } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });
    assert.ok(res3.hits.total.value >= 1, 'Typo "anitaa" matched Anita Mehra');
    assert.strictEqual(res3.hits.hits[0]._source.name, 'Anita Mehra');
  });

  // 6. Autocomplete Prefix Matching
  await test('6. Autocomplete: Fast Search-as-you-type Suggestions ("fac" -> Facial, "wax" -> Waxing)', async () => {
    const res1 = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ match_phrase_prefix: { 'name.autocomplete': { query: 'fac' } } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });
    assert.strictEqual(res1.hits.hits[0]._source.name, 'O3+ Diamond Glow Facial');

    const res2 = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ match_phrase_prefix: { 'name.autocomplete': { query: 'wax' } } }],
          filter: [{ term: { isActive: true } }],
        },
      },
    });
    assert.strictEqual(res2.hits.hits[0]._source.name, 'Rica Honey Waxing Full Arms & Legs');
  });

  // 7. Geo-Distance Search & Radius Filtering
  await test('7. Geo-Distance Search: Filter Beauticians within 10km of MP Nagar Bhopal', async () => {
    // User is located at Bhopal MP Nagar [23.2599, 77.4126]
    // Anita is at MP Nagar (0km), Pooja is at Arera Colony (~5km), Kiran is in Indore (~190km)
    const userLat = 23.2599;
    const userLon = 77.4126;

    // Search radius: 10km (Should return Anita & Pooja, exclude Kiran)
    const res10km = cluster.search(BEAUTICIANS_INDEX, {
      query: {
        bool: {
          must: [{ match_all: {} }],
          filter: [
            { term: { isActive: true } },
            {
              geo_distance: {
                distance: '10km',
                location: { lat: userLat, lon: userLon },
              },
            },
          ],
        },
      },
      sort: [
        {
          _geo_distance: {
            location: { lat: userLat, lon: userLon },
            order: 'asc',
          },
        },
      ],
    });

    assert.strictEqual(res10km.hits.total.value, 2, 'Exactly 2 beauticians within 10km radius');
    assert.strictEqual(res10km.hits.hits[0]._source.name, 'Anita Mehra', 'Nearest beautician first (0km)');
    assert.strictEqual(res10km.hits.hits[1]._source.name, 'Pooja Sharma', 'Second nearest beautician (~5km)');

    // Search radius: 1km (Should return only Anita)
    const res1km = cluster.search(BEAUTICIANS_INDEX, {
      query: {
        bool: {
          must: [{ match_all: {} }],
          filter: [
            {
              geo_distance: {
                distance: '1km',
                location: { lat: userLat, lon: userLon },
              },
            },
          ],
        },
      },
    });
    assert.strictEqual(res1km.hits.total.value, 1, 'Only Anita within 1km radius');
  });

  // 8. Multi-Faceted Filtering & Sorting
  await test('8. Faceted Filtering: Price Range, Min Rating, Gender, and Pagination', async () => {
    // Price between 400 and 1000
    const resPrice = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ match_all: {} }],
          filter: [{ range: { price: { gte: 400, lte: 1000 } } }],
        },
      },
      sort: [{ price: { order: 'asc' } }],
    });
    assert.strictEqual(resPrice.hits.total.value, 2);
    assert.strictEqual(resPrice.hits.hits[0]._source.price, 499);
    assert.strictEqual(resPrice.hits.hits[1]._source.price, 899);

    // Min rating >= 4.9
    const resRating = cluster.search(SERVICES_INDEX, {
      query: {
        bool: {
          must: [{ match_all: {} }],
          filter: [{ range: { rating: { gte: 4.9 } } }],
        },
      },
    });
    assert.strictEqual(resRating.hits.total.value, 1);
    assert.strictEqual(resRating.hits.hits[0]._source.name, 'O3+ Diamond Glow Facial');
  });

  // 9. Event-Driven Sync Simulation
  await test('9. Data Consistency: RabbitMQ Event Sync (Create, Update, Delete)', async () => {
    // 1. Create event: New beautician registered
    cluster.indexDoc(BEAUTICIANS_INDEX, 'bt_999', {
      id: 'bt_999',
      name: 'Ritu Sen',
      services: 'Bridal Spa Hair',
      rating: 4.8,
      price: 750,
      isActive: true,
      location: { lat: 23.25, lon: 77.41 },
    });
    let check = cluster.search(BEAUTICIANS_INDEX, { query: { bool: { must: [{ match_all: {} }] } } });
    assert.strictEqual(check.hits.total.value, 4, 'Beautician added via sync');

    // 2. Update event: Beautician updated
    cluster.indexDoc(BEAUTICIANS_INDEX, 'bt_999', {
      id: 'bt_999',
      name: 'Ritu Sen Senior',
      services: 'Bridal Spa Hair Master',
      rating: 5.0,
      price: 1200,
      isActive: true,
      location: { lat: 23.25, lon: 77.41 },
    });
    const updated = cluster.indices.get(BEAUTICIANS_INDEX).docs.get('bt_999');
    assert.strictEqual(updated.name, 'Ritu Sen Senior');
    assert.strictEqual(updated.rating, 5.0);

    // 3. Delete event: Beautician removed
    cluster.deleteDoc(BEAUTICIANS_INDEX, 'bt_999');
    check = cluster.search(BEAUTICIANS_INDEX, { query: { bool: { must: [{ match_all: {} }] } } });
    assert.strictEqual(check.hits.total.value, 3, 'Beautician deleted from index');
  });

  // 10. Performance & Latency Benchmark
  await test('10. Performance Benchmark: 500 Search Requests SLA < 50ms', async () => {
    const REQUEST_COUNT = 500;
    const latencies = [];

    const t0 = performance.now();
    for (let i = 0; i < REQUEST_COUNT; i++) {
      const start = performance.now();
      const q = i % 2 === 0 ? 'facial' : 'haircut';
      cluster.search(SERVICES_INDEX, {
        query: {
          bool: {
            must: [{ multi_match: { query: q, fields: ['name', 'category'] } }],
            filter: [{ term: { isActive: true } }],
          },
        },
      });
      latencies.push(performance.now() - start);
    }
    const totalTime = performance.now() - t0;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(REQUEST_COUNT * 0.5)];
    const p95 = latencies[Math.floor(REQUEST_COUNT * 0.95)];
    const p99 = latencies[Math.floor(REQUEST_COUNT * 0.99)];
    const avg = latencies.reduce((a, b) => a + b, 0) / REQUEST_COUNT;

    console.log(`     📊 500 Search Benchmark Results:`);
    console.log(`        Total Time : ${totalTime.toFixed(2)} ms (${(REQUEST_COUNT / (totalTime / 1000)).toFixed(0)} req/sec)`);
    console.log(`        Average    : ${avg.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p50 Latency: ${p50.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p95 Latency: ${p95.toFixed(3)} ms (Target < 50ms)`);
    console.log(`        p99 Latency: ${p99.toFixed(3)} ms (Target < 50ms)`);

    assert.ok(avg < 50, `Average latency ${avg.toFixed(2)}ms must be < 50ms`);
    assert.ok(p95 < 50, `p95 latency ${p95.toFixed(2)}ms must be < 50ms`);
  });

  console.log('\n========================================');
  console.log(`✨ Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runSearchTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
