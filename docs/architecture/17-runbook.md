# 17 - Operational Runbook & Incident Management

## Service Management Operations

### 1. Starting Services Locally
```bash
# Start all infrastructure and microservices
docker-compose up -d

# Start specific service
docker-compose up -d booking-service
```

### 2. Monitoring & Diagnostics
- **Grafana Dashboards**: `http://localhost:3000` (admin/admin)
- **Prometheus Metrics**: `http://localhost:9090`
- **RabbitMQ Management Console**: `http://localhost:15672` (guest/guest)
- **Centralized Loki Logs**: Explore query `{container=~".+"} |= "error"` in Grafana Explore.

### 3. Checking Service Health
```bash
curl http://localhost:8080/health
curl http://localhost:3005/ready
```

### 4. DLQ Inspection & Message Reprocessing
```bash
# Check messages accumulated in DLQ
curl -u guest:guest http://localhost:15672/api/queues/%2f/getready.dlq
```
