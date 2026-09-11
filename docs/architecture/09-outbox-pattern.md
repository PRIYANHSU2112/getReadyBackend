# 09 - Transactional Outbox Pattern

## Dual-Write Problem Prevention

In distributed systems, writing to a database and publishing to a message broker in separate steps risks inconsistency if one fails. The Transactional Outbox pattern guarantees that database state and domain events are committed atomically within a single local database transaction.

```mermaid
sequenceDiagram
    participant Client
    participant Service as Booking Service
    participant DB as Booking Database (MongoDB)
    participant Publisher as Outbox Publisher / Poller
    participant RabbitMQ as RabbitMQ Broker

    Client->>Service: Create Booking Request
    activate Service
    Service->>DB: Begin Transaction
    Service->>DB: Insert Booking (Status: PENDING)
    Service->>DB: Insert Outbox Event (Status: PENDING, EventType: BookingCreated)
    Service->>DB: Commit Transaction
    Service-->>Client: 201 Created (Booking Placed)
    deactivate Service

    loop Every 2 Seconds
        Publisher->>DB: Find Pending Outbox Events
        DB-->>Publisher: [Event 1, Event 2]
        Publisher->>RabbitMQ: Publish to getready.domain.events
        RabbitMQ-->>Publisher: ACK Confirm
        Publisher->>DB: Update Outbox Event (Status: PUBLISHED, publishedAt: Now)
    end
```

## Outbox Document Schema
```typescript
interface OutboxEvent {
  id: string;
  eventId: string;
  aggregateType: 'Booking' | 'Payment' | 'Wallet';
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, any>;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  attempts: number;
  createdAt: Date;
  publishedAt?: Date;
  lastError?: string;
}
```
