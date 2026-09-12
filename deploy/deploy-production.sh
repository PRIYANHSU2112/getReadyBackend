#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — AWS PRODUCTION DEPLOYMENT SCRIPT
# Target: AWS EC2 (i-0a4e7008ca42520d2 / getReady-backend)
# ECR Registry Domain : 154458646293.dkr.ecr.ap-south-1.amazonaws.com
# ECR Repository      : getready-backend
# Region              : ap-south-1
# IAM Role            : getready-ec2-ecr-role (EC2 Instance Profile)
#
# SECURITY & COMPLIANCE:
# - Dotenv files are NEVER executed as shell scripts (NO source, ., eval, bash, sh)
# - Secrets and tokens are NEVER logged or echoed
# - Native Docker Compose --env-file is used for container variable injection
# - AWS ECR Docker login uses non-interactive --password-stdin with EC2 IAM Role
# - ECR image references resolve to exactly ONE repository prefix
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"
STATE_FILE="deployment-state.env"

AWS_REGION="ap-south-1"
AWS_DEFAULT_REGION="ap-south-1"
ECR_REGISTRY_DOMAIN="154458646293.dkr.ecr.ap-south-1.amazonaws.com"
ECR_REPOSITORY="getready-backend"
# Complete ECR Image Prefix used by Docker Compose (contains repository name exactly ONCE)
ECR_REGISTRY="${ECR_REGISTRY_DOMAIN}/${ECR_REPOSITORY}"
EXPECTED_IAM_ROLE="getready-ec2-ecr-role"

# 1. Determine Target IMAGE_TAG (Command-line argument or environment variable)
TARGET_IMAGE_TAG="${1:-${IMAGE_TAG:-}}"

echo "================================================================="
echo "🚀 STARTING GET READY BACKEND PRODUCTION DEPLOYMENT"
echo "   Working Directory : ${SCRIPT_DIR}"
echo "   Environment File  : ${ENV_FILE}"
echo "   Compose File      : ${COMPOSE_FILE}"
echo "   Target Image Tag  : ${TARGET_IMAGE_TAG}"
echo "   AWS Region        : ${AWS_REGION}"
echo "   ECR Registry      : ${ECR_REGISTRY_DOMAIN}"
echo "   ECR Repository    : ${ECR_REPOSITORY}"
echo "   Timestamp         : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 2. Validate prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ ERROR: docker is not installed on this host."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ ERROR: docker compose plugin is not installed."; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ ERROR: AWS CLI is not installed on this host."; exit 1; }

if [ -z "${TARGET_IMAGE_TAG}" ]; then
  echo "❌ ERROR: TARGET_IMAGE_TAG is not set."
  echo "   Usage: ./deploy-production.sh <git-commit-sha>"
  exit 1
fi

# 3. Verify and safely load .env.production
if [ ! -f "${ENV_FILE}" ]; then
  echo "❌ ERROR: Environment file '${ENV_FILE}' not found in ${SCRIPT_DIR}."
  echo "   Please create ${ENV_FILE} from .env.production.example and configure production credentials."
  exit 1
fi

# Source validation helpers if available or use embedded safe loader
if [ -f "./validate-env-production.sh" ]; then
  # shellcheck disable=SC1091
  source "./validate-env-production.sh"
  echo "🛡️ Running pre-flight environment sanitization and validation..."
  sanitize_env_file "${ENV_FILE}"
  validate_production_env "${ENV_FILE}"
else
  # Embedded safe dotenv loader fallback (zero execution, pure string parsing)
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
  safe_load_env "${ENV_FILE}"
fi

# Validate critical production environment variables in memory
if [ -z "${DATABASE_URI:-}" ]; then
  echo "❌ ERROR: DATABASE_URI is missing from ${ENV_FILE}."
  exit 1
fi

if [[ "${DATABASE_URI}" =~ localhost|127\.0\.0\.1|getready_dev|/test ]]; then
  echo "❌ ERROR: Production DATABASE_URI cannot reference localhost, 127.0.0.1, or dev databases."
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "❌ ERROR: JWT_SECRET is missing or less than 32 characters in ${ENV_FILE}."
  exit 1
fi

# 4. Record previous state for automatic rollback (safely without source)
PREVIOUS_IMAGE_TAG=""
if [ -f "${STATE_FILE}" ]; then
  safe_load_env "${STATE_FILE}"
  PREVIOUS_IMAGE_TAG="${CURRENT_IMAGE_TAG:-}"
fi

echo "📋 Recorded Previous Image Tag: ${PREVIOUS_IMAGE_TAG:-<none>}"

# 5. Authenticate Docker with Amazon ECR using EC2 IAM Role
echo "================================================================="
echo "🔑 AWS ECR AUTHENTICATION & EC2 IAM IDENTITY VERIFICATION"
echo "   AWS Region    : ${AWS_REGION}"
echo "   ECR Registry  : ${ECR_REGISTRY_DOMAIN}"
echo "   Repository    : ${ECR_REPOSITORY}"
echo "   Expected Role : ${EXPECTED_IAM_ROLE}"
echo "================================================================="

# 5.1 Safe diagnostic of credential environment variables (names only, NEVER values)
echo "📋 AWS Credential Environment Diagnostics (pre-auth status):"
echo "   AWS_ACCESS_KEY_ID           : $([ -n "${AWS_ACCESS_KEY_ID:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_SECRET_ACCESS_KEY       : $([ -n "${AWS_SECRET_ACCESS_KEY:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_SESSION_TOKEN           : $([ -n "${AWS_SESSION_TOKEN:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_SECURITY_TOKEN          : $([ -n "${AWS_SECURITY_TOKEN:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_PROFILE                 : $([ -n "${AWS_PROFILE:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_DEFAULT_PROFILE         : $([ -n "${AWS_DEFAULT_PROFILE:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_SHARED_CREDENTIALS_FILE : $([ -n "${AWS_SHARED_CREDENTIALS_FILE:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_CONFIG_FILE             : $([ -n "${AWS_CONFIG_FILE:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_WEB_IDENTITY_TOKEN_FILE : $([ -n "${AWS_WEB_IDENTITY_TOKEN_FILE:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"
echo "   AWS_ROLE_ARN                : $([ -n "${AWS_ROLE_ARN:-}" ] && echo "PRESENT (clearing for EC2 role)" || echo "UNSET")"

# 5.2 Explicitly clear credential environment variables so AWS CLI uses EC2 IAM role exclusively
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN
unset AWS_SECURITY_TOKEN
unset AWS_PROFILE
unset AWS_DEFAULT_PROFILE
unset AWS_SHARED_CREDENTIALS_FILE
unset AWS_CONFIG_FILE
unset AWS_WEB_IDENTITY_TOKEN_FILE
unset AWS_ROLE_ARN

export AWS_REGION="ap-south-1"
export AWS_DEFAULT_REGION="ap-south-1"

# 5.3 Safely verify AWS Caller Identity and ensure it matches the EC2 IAM Role
echo "🔍 Verifying AWS IAM Caller Identity via EC2 Instance Profile..."
CALLER_IDENTITY_RAW=$(aws sts get-caller-identity --region "${AWS_REGION}" --output json 2>&1) || {
  echo "❌ ERROR: Failed to get AWS caller identity."
  echo "${CALLER_IDENTITY_RAW}"
  exit 1
}

CALLER_ARN=$(echo "${CALLER_IDENTITY_RAW}" | jq -r '.Arn // ""' 2>/dev/null || echo "")
if [[ "${CALLER_ARN}" =~ ${EXPECTED_IAM_ROLE} ]]; then
  echo "✅ EC2 IAM Identity Verified: ${CALLER_ARN}"
else
  echo "❌ ERROR: Unexpected AWS IAM identity: ${CALLER_ARN}"
  echo "   Expected EC2 IAM Role: ${EXPECTED_IAM_ROLE}"
  exit 1
fi

# 5.4 Safely verify ECR token retrieval without printing token
echo "🔍 Verifying ECR authorization token retrieval..."
if aws ecr get-login-password --region "${AWS_REGION}" >/dev/null 2>&1; then
  echo "ECR authorization token retrieval: SUCCESS"
else
  echo "ECR authorization token retrieval: FAILED"
  echo "❌ ERROR: Failed to retrieve ECR login token for region ${AWS_REGION}."
  exit 1
fi

# 5.5 Non-interactive Docker login with --password-stdin
echo "🐳 Authenticating Docker client with ECR registry (${ECR_REGISTRY_DOMAIN})..."
if ! aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login \
        --username AWS \
        --password-stdin \
        "${ECR_REGISTRY_DOMAIN}"; then
  echo "❌ ERROR: Failed to authenticate Docker with Amazon ECR."
  exit 1
fi

echo "ECR Docker authentication: SUCCESS"

# 6. Validate Docker Compose Syntax and ECR Image References
echo "🔍 Validating Docker Compose configuration..."
export IMAGE_TAG="${TARGET_IMAGE_TAG}"
export ECR_REGISTRY="${ECR_REGISTRY_DOMAIN}/${ECR_REPOSITORY}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config > /dev/null
echo "✅ Docker Compose configuration is valid."

# 6.1 Safe pre-flight image reference validation
echo "================================================================="
echo "🔍 PRE-FLIGHT ECR IMAGE REFERENCE VALIDATION"
echo "   Target SHA : ${TARGET_IMAGE_TAG}"
echo "================================================================="

SERVICES=(
  "api-gateway"
  "auth-service"
  "user-service"
  "beautician-service"
  "catalog-service"
  "booking-service"
  "cart-service"
  "payment-service"
  "wallet-service"
  "notification-service"
  "content-service"
  "worker-service"
)

IMAGE_VALIDATION_FAILED=0
for svc in "${SERVICES[@]}"; do
  RESOLVED_IMAGE="${ECR_REGISTRY}:${svc}-${TARGET_IMAGE_TAG}"
  echo "  • ${svc}:"
  echo "    ${RESOLVED_IMAGE}"

  if [[ "${RESOLVED_IMAGE}" =~ getready-backend/getready-backend ]]; then
    echo "    ❌ ERROR: Invalid ECR image reference: repository name duplicated in ${RESOLVED_IMAGE}" >&2
    IMAGE_VALIDATION_FAILED=1
  fi

  if [[ ! "${RESOLVED_IMAGE}" =~ ^154458646293\.dkr\.ecr\.ap-south-1\.amazonaws\.com/getready-backend:${svc}-[0-9a-fA-F]{40}$ ]]; then
    echo "    ❌ ERROR: Image reference does not match required format (expected 40-character SHA tag)." >&2
    IMAGE_VALIDATION_FAILED=1
  fi
done

if [ ${IMAGE_VALIDATION_FAILED} -ne 0 ]; then
  echo "❌ ERROR: ECR image reference pre-flight validation failed. Aborting deployment." >&2
  exit 1
fi
echo "✅ All 12 microservice image references validated successfully (0 duplicate repository paths)."

# 7. Pull all 12 microservice images before stopping anything
echo "================================================================="
echo "📦 Pulling all microservice images for tag ${TARGET_IMAGE_TAG}..."
echo "================================================================="
if ! docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull; then
  echo "❌ ERROR: Failed to pull images from ECR for tag ${TARGET_IMAGE_TAG}."
  echo "   Aborting deployment before containers are modified."
  exit 1
fi
echo "✅ All required container images pulled successfully."

# Function for automated rollback on failure
execute_rollback() {
  echo "⚠️ ==============================================================="
  echo "⚠️ DEPLOYMENT FAILED — INITIATING AUTOMATED ROLLBACK"
  echo "⚠️ ==============================================================="

  if [ -n "${PREVIOUS_IMAGE_TAG}" ] && [ "${PREVIOUS_IMAGE_TAG}" != "${TARGET_IMAGE_TAG}" ]; then
    echo "⏪ Rolling back to previous stable tag: ${PREVIOUS_IMAGE_TAG}..."
    export IMAGE_TAG="${PREVIOUS_IMAGE_TAG}"
    export ECR_REGISTRY="${ECR_REGISTRY_DOMAIN}/${ECR_REPOSITORY}"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans || true
    
    echo "⏳ Waiting 15s for rollback containers to stabilize..."
    sleep 15
    
    if [ -f "./health-check.sh" ]; then
      chmod +x ./health-check.sh
      ./health-check.sh "${ENV_FILE}" "${COMPOSE_FILE}" || echo "⚠️ Rollback health probe showed warnings."
    fi
    
    cat <<EOF > "${STATE_FILE}"
PREVIOUS_IMAGE_TAG="${PREVIOUS_IMAGE_TAG}"
CURRENT_IMAGE_TAG="${PREVIOUS_IMAGE_TAG}"
LAST_DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
LAST_STATUS="FAILED_AND_ROLLED_BACK"
FAILED_TAG="${TARGET_IMAGE_TAG}"
EOF
    echo "✅ Rollback completed to ${PREVIOUS_IMAGE_TAG}."
  else
    echo "⚠️ No valid previous tag found to roll back to. Keeping current containers for inspection."
    cat <<EOF > "${STATE_FILE}"
PREVIOUS_IMAGE_TAG=""
CURRENT_IMAGE_TAG="${TARGET_IMAGE_TAG}"
LAST_DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
LAST_STATUS="FAILED_NO_ROLLBACK"
EOF
  fi

  echo "📋 Container Status:"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
  exit 1
}

# 8. Start / update containers safely
echo "🚢 Deploying updated containers..."
if ! docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans; then
  echo "❌ ERROR: docker compose up failed."
  execute_rollback
fi

# 9. Wait for health checks to stabilize
echo "⏳ Waiting 20 seconds for services to initialize and register healthy..."
sleep 20

# 10. Run comprehensive health verification
echo "🩺 Running health verification probe..."
HEALTH_SCRIPT="./health-check.sh"
if [ -f "${HEALTH_SCRIPT}" ]; then
  chmod +x "${HEALTH_SCRIPT}"
  if ! "${HEALTH_SCRIPT}" "${ENV_FILE}" "${COMPOSE_FILE}"; then
    echo "❌ ERROR: One or more critical microservices failed health checks."
    echo "📋 Dumping recent container logs for inspection:"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail 30 api-gateway auth-service user-service || true
    execute_rollback
  fi
else
  echo "⚠️ Warning: health-check.sh not found. Checking basic container statuses..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
fi

# 11. Safe image cleanup (only dangling unreferenced images, NO volume deletion)
echo "🧹 Safely pruning dangling docker images..."
docker image prune -f > /dev/null 2>&1 || true

# 12. Record successful deployment in state file
cat <<EOF > "${STATE_FILE}"
PREVIOUS_IMAGE_TAG="${PREVIOUS_IMAGE_TAG}"
CURRENT_IMAGE_TAG="${TARGET_IMAGE_TAG}"
LAST_DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
LAST_STATUS="SUCCESS"
EOF

echo "================================================================="
echo "🎉 PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "   Active Version : ${TARGET_IMAGE_TAG}"
echo "   Gateway Port   : ${GATEWAY_PORT:-3000}"
echo "   Health URL     : http://127.0.0.1:${GATEWAY_PORT:-3000}/health"
echo "================================================================="
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
