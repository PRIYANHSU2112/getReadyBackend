# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package*.json ./

FROM base AS deps
RUN npm ci --omit=dev

FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Avoid chown -R /app — Docker Desktop on Windows fails layer extract (Lchown read-only FS).
# node:alpine already has user `node`; ensure nodejs group and writable uploads only.
RUN addgroup -S nodejs \
  && (getent passwd node >/dev/null || adduser -S node -G nodejs) \
  && addgroup node nodejs 2>/dev/null || true \
  && mkdir -p /app/uploads \
  && chown node:nodejs /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["dumb-init", "node", "src/server.js"]
