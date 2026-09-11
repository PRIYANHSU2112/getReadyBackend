#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — COMPREHENSIVE HEALTH CHECK SCRIPT
# Validates API Gateway, 12 Microservices, Redis, RabbitMQ, and Monitoring
# =============================================================================

set -eo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.production.yml"

echo "-----------------------------------------------------------------"
echo "🩺 PROBING GET READY BACKEND HEALTH & METRICS"
echo "-----------------------------------------------------------------"

FAILED_SERVICES=0

# Helper function to check container health via docker exec
check_service_health() {
  local container_name="$1"
  local check_type="$2"
  local command="$3"

  printf "  • Checking %-28s ... " "${container_name}"

  if ! docker ps --filter "name=${container_name}" --format '{{.Names}}' | grep -q "${container_name}"; then
    printf "❌ NOT RUNNING\n"
    FAILED_SERVICES=$((FAILED_SERVICES + 1))
    return
  fi

  if [ "${check_type}" == "exec" ]; then
    if docker exec "${container_name}" sh -c "${command}" >/dev/null 2>&1; then
      printf "✅ HEALTHY\n"
    else
      printf "❌ UNHEALTHY (command failed: %s)\n" "${command}"
      FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
  fi
}

# 1. Reverse Proxy
check_service_health "getready-nginx" "exec" "wget -qO- http://127.0.0.1/nginx-health"

# 2. Infrastructure
check_service_health "getready-redis" "exec" "redis-cli ping | grep PONG"
check_service_health "getready-rabbitmq" "exec" "rabbitmq-diagnostics -q ping"

# 3. Observability
check_service_health "getready-prometheus" "exec" "wget -qO- http://127.0.0.1:9090/-/healthy"
check_service_health "getready-grafana" "exec" "wget -qO- http://127.0.0.1:3000/api/health"
check_service_health "getready-loki" "exec" "wget -qO- http://127.0.0.1:3100/ready"
check_service_health "getready-promtail" "exec" "wget -qO- http://127.0.0.1:9080/ready || true"

# 4. API Gateway
check_service_health "getready-api-gateway" "exec" "wget -qO- http://127.0.0.1:3000/health"

# 5. Microservices
SERVICES=(
  "getready-auth-service:3001"
  "getready-user-service:3002"
  "getready-beautician-service:3003"
  "getready-catalog-service:3004"
  "getready-booking-service:3005"
  "getready-cart-service:3006"
  "getready-payment-service:3007"
  "getready-wallet-service:3008"
  "getready-notification-service:3009"
  "getready-content-service:3010"
  "getready-worker-service:3011"
)

for item in "${SERVICES[@]}"; do
  IFS=":" read -r name port <<< "${item}"
  check_service_health "${name}" "exec" "wget -qO- http://127.0.0.1:${port}/health"
done

echo "-----------------------------------------------------------------"
if [ ${FAILED_SERVICES} -eq 0 ]; then
  echo "✅ ALL SERVICES AND INFRASTRUCTURE CONTAINERS ARE HEALTHY."
  exit 0
else
  echo "❌ ${FAILED_SERVICES} SERVICE(S) FAILED HEALTH CHECKS."
  exit 1
fi
