#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION ROLLBACK SCRIPT
# Reverts containers to previous state in the event of deployment failure
# =============================================================================

set -eo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"
PREVIOUS_COMMIT="${2:-HEAD~1}"

echo "================================================================="
echo "⏪ INITIATING GET READY BACKEND ROLLBACK"
echo "   Target Commit/Tag : ${PREVIOUS_COMMIT}"
echo "   Environment File  : ${ENV_FILE}"
echo "   Timestamp         : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Check if git repository is available
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "🔍 Checking out previous stable commit ${PREVIOUS_COMMIT}..."
  git checkout "${PREVIOUS_COMMIT}"
fi

# 2. Rebuild and restart containers
echo "🔄 Rebuilding and launching previous stable containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build --parallel
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

# 3. Health verification after rollback
echo "🩺 Verifying container health after rollback..."
sleep 15

if [ -f "./scripts/health-check.sh" ]; then
  ./scripts/health-check.sh "${ENV_FILE}"
fi

echo "================================================================="
echo "✅ ROLLBACK COMPLETED SUCCESSFULLY."
echo "================================================================="
