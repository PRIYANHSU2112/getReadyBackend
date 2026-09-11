#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION ROLLBACK SCRIPT
# Reverts microservices to a previously stable IMAGE_TAG
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"
STATE_FILE="deployment-state.env"

echo "================================================================="
echo "⏪ INITIATING GET READY BACKEND PRODUCTION ROLLBACK"
echo "   Directory : ${SCRIPT_DIR}"
echo "   Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Load deployment state
PREVIOUS_TAG=""
if [ -f "${STATE_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  PREVIOUS_TAG="${PREVIOUS_IMAGE_TAG:-}"
fi

TARGET_TAG="${1:-${PREVIOUS_TAG}}"

if [ -z "${TARGET_TAG}" ]; then
  echo "❌ ERROR: No rollback target IMAGE_TAG specified and no PREVIOUS_IMAGE_TAG found in ${STATE_FILE}."
  echo "   Usage: ./rollback-production.sh <git-commit-sha>"
  exit 1
fi

echo "🎯 Target Rollback Image Tag : ${TARGET_TAG}"

# 2. Verify environment file
if [ ! -f "${ENV_FILE}" ]; then
  echo "❌ ERROR: Environment file '${ENV_FILE}' not found."
  exit 1
fi

# 3. Pull target rollback images
echo "📦 Pulling rollback images for tag: ${TARGET_TAG}..."
IMAGE_TAG="${TARGET_TAG}" docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

# 4. Deploy rollback containers
echo "🚀 Applying rollback containers..."
IMAGE_TAG="${TARGET_TAG}" docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

# 5. Wait for containers to stabilize and execute health check
echo "⏳ Waiting 15 seconds for containers to stabilize..."
sleep 15

HEALTH_SCRIPT="./health-check.sh"
if [ -f "${HEALTH_SCRIPT}" ]; then
  chmod +x "${HEALTH_SCRIPT}"
  echo "🩺 Verifying container health after rollback..."
  if ! "${HEALTH_SCRIPT}" "${ENV_FILE}" "${COMPOSE_FILE}"; then
    echo "❌ CRITICAL: Health checks failed after rollback."
    exit 1
  fi
fi

# 6. Update deployment state
cat <<EOF > "${STATE_FILE}"
PREVIOUS_IMAGE_TAG="${CURRENT_IMAGE_TAG:-}"
CURRENT_IMAGE_TAG="${TARGET_TAG}"
LAST_DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
LAST_STATUS="ROLLED_BACK_SUCCESS"
EOF

echo "================================================================="
echo "🎉 ROLLBACK COMPLETED SUCCESSFULLY!"
echo "   Active Production Version : ${TARGET_TAG}"
echo "================================================================="
