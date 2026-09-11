# 12 - Observability Stack (Prometheus, Grafana, Loki)

## Full Observability Pipeline

```mermaid
flowchart TD
    subgraph Microservices Fleet
        S1[api-gateway]
        S2[auth-service]
        S3[user-service]
        S4[beautician-service]
        S5[catalog-service]
        S6[booking-service]
        S7[cart-service]
        S8[payment-service]
        S9[wallet-service]
        S10[notification-service]
        S11[content-service]
        S12[worker-service]
    end

    subgraph Metrics Collection
        Prometheus[Prometheus Server :9090]
        S1 -->|/metrics| Prometheus
        S2 -->|/metrics| Prometheus
        S3 -->|/metrics| Prometheus
        S4 -->|/metrics| Prometheus
        S5 -->|/metrics| Prometheus
        S6 -->|/metrics| Prometheus
        S7 -->|/metrics| Prometheus
        S8 -->|/metrics| Prometheus
        S9 -->|/metrics| Prometheus
        S10 -->|/metrics| Prometheus
        S11 -->|/metrics| Prometheus
        S12 -->|/metrics| Prometheus
    end

    subgraph Log Aggregation
        DockerSock[Docker Daemon / Logs]
        Promtail[Promtail Agent :9080]
        Loki[Loki Central Log Store :3100]
        S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10 & S11 & S12 --> DockerSock
        DockerSock --> Promtail --> Loki
    end

    subgraph Visualization
        Grafana[Grafana Dashboards :3000]
        Prometheus --> Grafana
        Loki --> Grafana
    end
```

## Configured Dashboards
1. `GETREADY - SYSTEM OVERVIEW`: Global throughput, 4xx/5xx error rates, P95/P99 latency, and active connections.
2. `GETREADY - MICROSERVICES`: Per-service CPU/RAM utilization, request counters, and error distributions.
3. `GETREADY - RABBITMQ`: Published/consumed message rates, queue depths, retry executions, and DLQ tracking.
4. `GETREADY - DATABASE`: MongoDB query durations and active connection pools.
5. `GETREADY - BUSINESS`: Live booking creation, payment success/failure ratios, wallet transaction volume, and notification delivery stats.
