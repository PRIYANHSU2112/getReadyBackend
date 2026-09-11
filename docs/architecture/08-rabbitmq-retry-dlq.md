# 08 - RabbitMQ Retry and Dead Letter Queue (DLQ) Architecture

## Non-Blocking Exponential Backoff Pipeline

To prevent head-of-line blocking and catastrophic crash loops, consumer retries use dedicated dead-letter TTL queues.

```mermaid
flowchart TD
    Msg[New Event from getready.domain.events] --> MainQueue[Main Queue: e.g. booking.events.queue]
    MainQueue --> Consumer[Consumer Process]

    Consumer -->|Success| Ack[ACK Message]
    Consumer -->|Temporary Failure (Attempt 1)| Retry1[Retry Queue 1: TTL 5s]
    Consumer -->|Temporary Failure (Attempt 2)| Retry2[Retry Queue 2: TTL 25s]
    Consumer -->|Temporary Failure (Attempt 3)| Retry3[Retry Queue 3: TTL 125s]

    Retry1 -->|TTL Expired -> DLX Routing| MainQueue
    Retry2 -->|TTL Expired -> DLX Routing| MainQueue
    Retry3 -->|TTL Expired -> DLX Routing| MainQueue

    Consumer -->|Exhausted Max Retries (3)| DLQ[Dead Letter Queue: getready.dlq]
    DLQ --> DLQMonitor[Worker Service DLQ Monitor & Alerting]
```

## Retry Guarantees
1. **Never Blind Requeue**: `requeue=true` is avoided to eliminate tight retry loops.
2. **Exponential Backoff**: Delays increase exponentially (`5s`, `25s`, `125s`).
3. **Dead Letter Queue (DLQ)**: Failed messages include detailed failure reasons, retry counts, timestamp, and correlation IDs for inspection in Grafana and Loki.
