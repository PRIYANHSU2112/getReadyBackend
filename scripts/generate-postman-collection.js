import { mkdirSync, writeFileSync } from 'fs';
import { swaggerDocs } from '../src/core/swagger/docs.registry.js';

const paths = Object.assign({}, ...swaggerDocs.map((d) => d.paths || {}));
const baseUrl = '{{baseUrl}}';

function schemaExample(schema) {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.type === 'object' && schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      const ex = schemaExample(v);
      if (ex !== undefined) out[k] = ex;
    }
    return out;
  }
  if (schema.type === 'array') {
    const item = schemaExample(schema.items);
    return item !== undefined ? [item] : [];
  }
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'boolean') return true;
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'string') {
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
    return 'string';
  }
  return undefined;
}

function getBody(op) {
  const content = op.requestBody?.content;
  if (!content) return null;

  if (content['application/json']) {
    const json = content['application/json'];
    let raw;
    if (json.example) raw = json.example;
    else if (json.examples) {
      const first = Object.values(json.examples)[0];
      raw = first?.value ?? first;
    } else raw = schemaExample(json.schema) ?? {};

    return {
      mode: 'raw',
      raw: JSON.stringify(raw, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  if (content['multipart/form-data']) {
    const props = content['multipart/form-data'].schema?.properties || {};
    return {
      mode: 'formdata',
      formdata: Object.entries(props).map(([key, prop]) => ({
        key,
        type: prop.format === 'binary' ? 'file' : 'text',
        src: prop.format === 'binary' ? [] : undefined,
        value: prop.format === 'binary' ? undefined : String(schemaExample(prop) ?? ''),
        description: prop.description || '',
      })),
    };
  }

  return null;
}

function getQuery(op) {
  return (op.parameters || [])
    .filter((p) => p.in === 'query')
    .map((p) => ({
      key: p.name,
      value: String(p.schema?.example ?? p.schema?.default ?? ''),
      description: p.description || '',
      disabled: false,
    }));
}

function getPathVars(_path, op) {
  return (op.parameters || [])
    .filter((p) => p.in === 'path')
    .map((p) => ({
      key: p.name,
      value: String(p.schema?.example ?? '507f1f77bcf86cd799439011'),
      description: p.description || '',
    }));
}

function pathToUrl(path, op) {
  const pathVars = getPathVars(path, op);
  const allQuery = getQuery(op);
  const segments = path
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^\{(.+)\}$/);
      return m ? `:${m[1]}` : seg;
    });

  const rawPath = path.replace(/\{([^}]+)\}/g, ':$1');
  const qs = allQuery.length
    ? `?${allQuery.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join('&')}`
    : '';

  return {
    raw: `${baseUrl}${rawPath}${qs}`,
    host: [baseUrl],
    path: segments,
    query: allQuery.length ? allQuery : undefined,
    variable: pathVars.length ? pathVars : undefined,
  };
}

const folders = new Map();

for (const [path, methods] of Object.entries(paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (!op || typeof op !== 'object' || !op.responses) continue;
    const tag = (op.tags && op.tags[0]) || 'Other';
    if (!folders.has(tag)) folders.set(tag, []);

    const isPublic = Array.isArray(op.security) && op.security.length === 0;
    const body = getBody(op);

    folders.get(tag).push({
      name: op.summary || `${method.toUpperCase()} ${path}`,
      request: {
        method: method.toUpperCase(),
        header:
          body?.mode === 'raw'
            ? [{ key: 'Content-Type', value: 'application/json' }]
            : [],
        body: body || undefined,
        url: pathToUrl(path, op),
        description: [
          op.description || '',
          isPublic
            ? 'Public (no auth).'
            : 'Requires Bearer JWT. Collection auth uses {{accessToken}} (auto-set after login).',
        ]
          .filter(Boolean)
          .join('\n\n'),
        auth: isPublic ? { type: 'noauth' } : undefined,
      },
      response: [],
    });
  }
}

const collection = {
  info: {
    name: 'Salon API',
    description:
      'Generated from Swagger/OpenAPI module docs.\n\n1. Set `baseUrl` (default http://localhost:5000)\n2. Run **Admin / Super Admin login**\n3. `accessToken` is saved automatically from `data.token`\n4. Call protected endpoints',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000' },
    { key: 'accessToken', value: '' },
  ],
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'if (pm.response.code === 200 || pm.response.code === 201) {',
          '  try {',
          '    const json = pm.response.json();',
          '    if (json && json.data && json.data.token) {',
          "      pm.collectionVariables.set('accessToken', json.data.token);",
          '    }',
          '  } catch (e) {}',
          '}',
        ],
      },
    },
  ],
  item: [...folders.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, items]) => ({ name, item: items })),
};

mkdirSync('./postman', { recursive: true });
const outPath = './postman/Salon-API.postman_collection.json';
writeFileSync(outPath, JSON.stringify(collection, null, 2));

const total = [...folders.values()].reduce((n, a) => n + a.length, 0);
console.log(`Wrote ${outPath} (${folders.size} folders, ${total} requests)`);
