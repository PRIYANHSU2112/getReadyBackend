#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION ROLLBACK SCRIPT
# Reverts microservices to a previously stable IMAGE_TAG
#
# SECURITY: Safe dotenv and state parsing without source or eval.
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"
STATE_FILE="deployment-state.env"
ECR_REGISTRY_DOMAIN="154458646293.dkr.ecr.ap-south-1.amazonaws.com"
ECR_REPOSITORY="getready-backend"
ECR_REGISTRY="${ECR_REGISTRY_DOMAIN}/${ECR_REPOSITORY}"

# Safe in-memory key-value loader
safe_load_env() {
  local target_file="$1"
  [ ! -f "${target_file}" ] && return 0
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    if [ -z "${trimmed}" ] || [[ "${trimmed}" =~ ^# ]]; then
      continue
    fi
    if [[ "${trimmed}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local k="${BASH_REMATCH[1]}"
      local v="${BASH_REMATCH[2]}"
      if [[ "${v}" =~ ^\"(.*)\"$ ]] || [[ "${v}" =~ ^\'(.*)\'$ ]]; then
        v="${BASH_REMATCH[1]}"
      fi
      export "${k}=${v}"
    fi
  done < "${target_file}"
}

echo "================================================================="
echo "⏪ INITIATING GET READY BACKEND PRODUCTION ROLLBACK"
echo "   Directory : ${SCRIPT_DIR}"
echo "   Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Load deployment state safely
PREVIOUS_TAG=""
if [ -f "${STATE_FILE}" ]; then
  safe_load_env "${STATE_FILE}"
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
export ECR_REGISTRY="${ECR_REGISTRY}"
export IMAGE_TAG="${TARGET_TAG}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

# 4. Deploy rollback containers
echo "🚀 Applying rollback containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

# 5. Wait for containers to stabilize and execute health check
echo "⏳ Waiting 15 seconds for rollback containers to stabilize..."
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
