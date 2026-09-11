# 02 - Target Microservices Architecture

## Overview
The target architecture is a production-grade distributed system based on Domain-Driven Design (DDD), Database-per-Service isolation, RabbitMQ event-driven choreography, and an API Gateway fronting all client requests.

```mermaid
flowchart TD
    Client[Mobile Apps / React Admin] -->|HTTPS REST| Gateway[API Gateway :8080]

    subgraph Edge Layer
        Gateway
    end

    subgraph Core Domains
        Auth[Auth Service :3001]
        User[User Service :3002]
        Beautician[Beautician Service :3003]
        Catalog[Catalog Service :3004]
        Booking[Booking Service :3005]
        Cart[Cart Service :3006]
        Payment[Payment Service :3007]
        Wallet[Wallet Service :3008]
        Notification[Notification Service :3009]
        Content[Content Service :3010]
        Worker[Worker Service :3011]
    end

    Gateway --> Auth
    Gateway --> User
    Gateway --> Beautician
    Gateway --> Catalog
    Gateway --> Booking
    Gateway --> Cart
    Gateway --> Payment
    Gateway --> Wallet
    Gateway --> Notification
    Gateway --> Content

    subgraph Messaging & Cache
        RabbitMQ[(RabbitMQ Topic Exchanges)]
        Redis[(Redis Cache & Distributed Locks)]
    end

    Auth -.->|Domain Events| RabbitMQ
    User -.->|Domain Events| RabbitMQ
    Booking -.->|Domain Events| RabbitMQ
    Payment -.->|Domain Events| RabbitMQ
    Wallet -.->|Domain Events| RabbitMQ
    RabbitMQ -.->|Idempotent Consume| Notification
    RabbitMQ -.->|Idempotent Consume| Wallet
    RabbitMQ -.->|Idempotent Consume| Booking
    RabbitMQ -.->|DLQ Inspection| Worker

    subgraph Observability
        Prometheus[Prometheus :9090]
        Grafana[Grafana :3000]
        Loki[Loki :3100]
    end

    Prometheus -->|Scrapes /metrics| Gateway
    Prometheus -->|Scrapes /metrics| Auth
    Prometheus -->|Scrapes /metrics| User
    Prometheus -->|Scrapes /metrics| Booking
    Prometheus -->|Scrapes /metrics| Payment
    Prometheus -->|Scrapes /metrics| Wallet
    Prometheus -->|Scrapes /metrics| RabbitMQ
    Grafana --> Prometheus
    Grafana --> Loki
```
