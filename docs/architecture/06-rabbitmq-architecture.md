# 06 - RabbitMQ Messaging Architecture

## Overview
RabbitMQ is the messaging backbone of the GetReady distributed platform. All asynchronous domain event distribution and command pipelines are coordinated via RabbitMQ topic exchanges.

```mermaid
flowchart LR
    subgraph Publishers
        P_Auth[auth-service]
        P_Booking[booking-service]
        P_Payment[payment-service]
        P_Wallet[wallet-service]
    end

    Exchange[Exchange: getready.domain.events<br/>Type: Topic]

    P_Auth -->|UserRegistered| Exchange
    P_Booking -->|BookingCreated| Exchange
    P_Payment -->|PaymentSucceeded| Exchange
    P_Wallet -->|WalletCredited| Exchange

    subgraph Queues
        Q_Booking[booking.events.queue]
        Q_Wallet[wallet.events.queue]
        Q_Notif[notification.events.queue]
    end

    Exchange -->|Booking.*| Q_Booking
    Exchange -->|Payment.*| Q_Wallet
    Exchange -->|*| Q_Notif

    subgraph Consumers
        Q_Booking --> C_Booking[booking-service]
        Q_Wallet --> C_Wallet[wallet-service]
        Q_Notif --> C_Notif[notification-service]
    end
```

## Exchanges
1. `getready.domain.events` (Topic, Durable): Dispatches all domain life-cycle events.
2. `getready.commands` (Direct, Durable): Asynchronous command routing.
3. `getready.retry` (Topic, Durable): Exponential backoff retry queue routing.
4. `getready.dlx` (Fanout, Durable): Dead Letter Exchange for unrecoverable errors.
