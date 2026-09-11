FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY services/auth-service/ ./services/auth-service/

RUN npm install --omit=dev

FROM base AS production
WORKDIR /app/services/auth-service

EXPOSE 3001
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/server.js"]
