# 04 - Service Dependencies & Inter-Service Communication

## Communication Matrix

```mermaid
flowchart LR
    Gateway[API Gateway] -->|REST| Auth[auth-service]
    Gateway -->|REST| User[user-service]
    Gateway -->|REST| Beautician[beautician-service]
    Gateway -->|REST| Catalog[catalog-service]
    Gateway -->|REST| Booking[booking-service]
    Gateway -->|REST| Cart[cart-service]
    Gateway -->|REST| Payment[payment-service]
    Gateway -->|REST| Wallet[wallet-service]
    Gateway -->|REST| Notification[notification-service]
    Gateway -->|REST| Content[content-service]

    Auth -->|REST Internal| User
    Cart -->|REST Internal| Catalog
    Booking -->|REST Internal| Catalog
    Booking -->|REST Internal| Beautician

    Auth -.->|RabbitMQ UserRegistered| RabbitMQ[(RabbitMQ)]
    Booking -.->|RabbitMQ BookingCreated| RabbitMQ
    Payment -.->|RabbitMQ PaymentSucceeded| RabbitMQ
    Wallet -.->|RabbitMQ WalletCredited| RabbitMQ

    RabbitMQ -.-> Notification
    RabbitMQ -.-> Wallet
    RabbitMQ -.-> Booking
```

## Synchronous REST Dependencies
1. **auth-service -> user-service**: To create or lookup user records during login, registration, and OTP verification.
2. **cart-service -> catalog-service**: To validate service items, combo packages, and fetch pricing snapshots.
3. **booking-service -> catalog-service & beautician-service**: To validate service durations and beautician availability.

## Asynchronous RabbitMQ Dependencies
1. **PaymentSucceeded -> booking-service & wallet-service**: Confirms booking or processes topup.
2. **BookingCreated / BookingConfirmed -> notification-service**: Dispatches customer and beautician notifications.
3. **BookingCancelled -> wallet-service**: Issues instant wallet refund.
