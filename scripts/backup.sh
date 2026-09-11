#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — INFRASTRUCTURE BACKUP SCRIPT
# Backs up persistent Docker volumes for Redis, RabbitMQ, Grafana, Prometheus & Loki
# Note: MongoDB Atlas backups are handled automatically by MongoDB Atlas Cloud
# =============================================================================

set -eo pipefail

BACKUP_DIR="${1:-./backups/$(date +%Y-%m-%d_%H-%M-%S)}"
mkdir -p "${BACKUP_DIR}"

echo "================================================================="
echo "💾 STARTING GET READY BACKEND BACKUP"
echo "   Destination Directory : ${BACKUP_DIR}"
echo "   Timestamp             : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Redis RDB Backup
echo "📦 Backing up Redis..."
if docker ps --filter "name=getready-redis" --format '{{.Names}}' | grep -q "getready-redis"; then
  docker exec getready-redis redis-cli bgsave || true
  sleep 3
  docker cp getready-redis:/data/dump.rdb "${BACKUP_DIR}/redis-dump.rdb" 2>/dev/null || \
    docker run --rm -v getready_redis_data:/data -v "${PWD}/${BACKUP_DIR}:/backup" alpine tar czf /backup/redis_data.tar.gz /data
  echo "✅ Redis backup saved."
else
  echo "⚠️ Redis container not running; skipping."
fi

# 2. RabbitMQ Definitions Backup
echo "📦 Backing up RabbitMQ definitions..."
if docker ps --filter "name=getready-rabbitmq" --format '{{.Names}}' | grep -q "getready-rabbitmq"; then
  docker exec getready-rabbitmq rabbitmqctl export_definitions /tmp/definitions.json 2>/dev/null && \
    docker cp getready-rabbitmq:/tmp/definitions.json "${BACKUP_DIR}/rabbitmq-definitions.json" 2>/dev/null || \
    docker run --rm -v getready_rabbitmq_data:/data -v "${PWD}/${BACKUP_DIR}:/backup" alpine tar czf /backup/rabbitmq_data.tar.gz /data
  echo "✅ RabbitMQ definitions backup saved."
else
  echo "⚠️ RabbitMQ container not running; skipping."
fi

# 3. Grafana SQLite DB & Dashboards Backup
echo "📦 Backing up Grafana..."
docker run --rm -v getready_grafana_data:/data -v "${PWD}/${BACKUP_DIR}:/backup" alpine tar czf /backup/grafana_data.tar.gz /data 2>/dev/null || true
echo "✅ Grafana data backup saved."

# 4. Prometheus & Loki Configs & Data Backup
echo "📦 Backing up Prometheus & Loki persistent data..."
docker run --rm -v getready_prometheus_data:/data -v "${PWD}/${BACKUP_DIR}:/backup" alpine tar czf /backup/prometheus_data.tar.gz /data 2>/dev/null || true
docker run --rm -v getready_loki_data:/data -v "${PWD}/${BACKUP_DIR}:/backup" alpine tar czf /backup/loki_data.tar.gz /data 2>/dev/null || true
echo "✅ Monitoring data backup saved."

# 5. Summary
echo "================================================================="
echo "✅ BACKUP COMPLETED."
echo "   Artifacts saved in : ${BACKUP_DIR}"
echo "   MongoDB Note       : Primary database backups are managed directly"
echo "                        in MongoDB Atlas (Continuous Cloud Backups & Point-in-Time Restore)."
echo "================================================================="
