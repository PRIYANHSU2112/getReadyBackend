#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — PRODUCTION HEALTH CHECK SCRIPT
# Probes API Gateway, all 12 microservices, Redis, RabbitMQ, and Observability
#
# SECURITY: Safe dotenv parsing without source, eval, or command execution.
# =============================================================================

set -eo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="${2:-docker-compose.production.yml}"

# Safe in-memory dotenv parser
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

# Safely load environment if present
if [ -f "${ENV_FILE}" ]; then
  safe_load_env "${ENV_FILE}"
fi

echo "================================================================="
echo "🩺 PROBING GET READY BACKEND PRODUCTION HEALTH"
echo "   Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

FAILED_COUNT=0

check_container() {
  local container_name="$1"
  local check_cmd="$2"
  local display_name="$3"

  printf "  • Checking %-32s ... " "${display_name}"

  # 1. Check if container is running
  if ! docker ps --filter "name=${container_name}" --format '{{.Names}}' | grep -q "^${container_name}$"; then
    printf "❌ NOT RUNNING\n"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    return 1
  fi

  # 2. Check internal command or probe
  if docker exec "${container_name}" sh -c "${check_cmd}" >/dev/null 2>&1; then
    printf "✅ HEALTHY\n"
    return 0
  else
    printf "❌ UNHEALTHY\n"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    return 1
  fi
}

echo "--- 1. Infrastructure Services ---"
check_container "getready-redis" "redis-cli -a '${REDIS_PASSWORD:-change_in_production}' ping 2>/dev/null | grep -q PONG || redis-cli ping | grep -q PONG" "Redis (6379)" || true
check_container "getready-rabbitmq" "rabbitmq-diagnostics -q ping" "RabbitMQ (5672)" || true

echo "--- 2. Observability Stack ---"
check_container "getready-prometheus" "wget -qO- http://127.0.0.1:9090/-/healthy" "Prometheus (9090)" || true
check_container "getready-grafana" "wget -qO- http://127.0.0.1:3000/api/health" "Grafana (3000)" || true
check_container "getready-loki" "wget -qO- http://127.0.0.1:3100/ready" "Loki (3100)" || true

echo "--- 3. API Gateway (Public Ingress) ---"
check_container "getready-api-gateway" "wget -qO- http://127.0.0.1:3000/health" "API Gateway (3000)" || true

# Test gateway health from host perspective as well if port 3000 is open
if command -v curl >/dev/null 2>&1; then
  printf "  • Host HTTP Probe (http://127.0.0.1:%s/health) ... " "${GATEWAY_PORT:-3000}"
  if curl -sf "http://127.0.0.1:${GATEWAY_PORT:-3000}/health" >/dev/null 2>&1; then
    printf "✅ HTTP 200 OK\n"
  else
    printf "⚠️ HOST PROBE FAILED (checking internal containers)\n"
  fi
fi

echo "--- 4. Core & Business Microservices ---"
SERVICES=(
  "getready-auth-service:3001:Auth Service"
  "getready-user-service:3002:User Service"
  "getready-beautician-service:3003:Beautician Service"
  "getready-catalog-service:3004:Catalog Service"
  "getready-booking-service:3005:Booking Service"
  "getready-cart-service:3006:Cart Service"
  "getready-payment-service:3007:Payment Service"
  "getready-wallet-service:3008:Wallet Service"
  "getready-notification-service:3009:Notification Service"
  "getready-content-service:3010:Content Service"
  "getready-worker-service:3011:Worker Service"
)

for item in "${SERVICES[@]}"; do
  IFS=":" read -r cname port label <<< "${item}"
  check_container "${cname}" "wget -qO- http://127.0.0.1:${port}/health" "${label} (${port})" || true
done

echo "================================================================="
if [ ${FAILED_COUNT} -eq 0 ]; then
  echo "✅ ALL 18 CONTAINERS (12 MICROSERVICES + 6 INFRA) ARE HEALTHY!"
  exit 0
else
  echo "❌ HEALTH CHECK FAILED: ${FAILED_COUNT} container(s) reported issues."
  exit 1
fi
