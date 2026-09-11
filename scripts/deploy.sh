#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION DEPLOYMENT SCRIPT
# Portable deployment across AWS EC2, DigitalOcean, Azure, GCP, Hetzner, etc.
# =============================================================================

set -eo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

echo "================================================================="
echo "🚀 STARTING GET READY BACKEND DEPLOYMENT"
echo "   Environment File : ${ENV_FILE}"
echo "   Compose File     : ${COMPOSE_FILE}"
echo "   Timestamp        : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Check prerequisite tools
command -v docker >/dev/null 2>&1 || { echo "❌ ERROR: docker is not installed"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ ERROR: docker compose is not installed"; exit 1; }

# 2. Verify environment file
if [ ! -f "${ENV_FILE}" ]; then
  echo "❌ ERROR: Environment file '${ENV_FILE}' not found."
  echo "   Please copy .env.production.example to ${ENV_FILE} and configure production values."
  exit 1
fi

# 3. Validate Docker Compose configuration
echo "🔍 Validating Docker Compose configuration..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config > /dev/null
echo "✅ Docker Compose configuration is valid."

# 4. Pull pre-built images or build locally
echo "📦 Building / Pulling container images..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build --parallel

# 5. Start / Update containers with rolling updates
echo "🚢 Launching Get Ready containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

# 6. Execute health check verification
echo "⏳ Waiting for health checks to stabilize (30 seconds)..."
sleep 15

HEALTH_SCRIPT="./scripts/health-check.sh"
if [ -f "${HEALTH_SCRIPT}" ]; then
  chmod +x "${HEALTH_SCRIPT}"
  echo "🩺 Executing comprehensive health probe..."
  "${HEALTH_SCRIPT}" "${ENV_FILE}"
else
  echo "⚠️ Warning: health-check.sh script not found, performing basic check:"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
fi

# 7. Clean up stale docker images
echo "🧹 Pruning dangling docker images..."
docker image prune -f > /dev/null 2>&1 || true

echo "================================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "   Gateway URL : https://api.getready.example.com"
echo "   Nginx Ingress: Ports 80 & 443"
echo "================================================================="
