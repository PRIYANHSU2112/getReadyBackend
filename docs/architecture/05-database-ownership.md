# 05 - Database Ownership per Service

Each microservice strictly owns its dedicated database (or database schema). Direct cross-service database access or foreign keys across service boundaries are completely prohibited.

```mermaid
flowchart TD
    subgraph Databases [Isolated Database Per Service]
        DB_Auth[(getready_auth)]
        DB_User[(getready_user)]
        DB_Beautician[(getready_beautician)]
        DB_Catalog[(getready_catalog)]
        DB_Booking[(getready_booking)]
        DB_Cart[(getready_cart)]
        DB_Payment[(getready_payment)]
        DB_Wallet[(getready_wallet)]
        DB_Notification[(getready_notification)]
        DB_Content[(getready_content)]
    end

    AuthSvc[auth-service] --> DB_Auth
    UserSvc[user-service] --> DB_User
    BeauticianSvc[beautician-service] --> DB_Beautician
    CatalogSvc[catalog-service] --> DB_Catalog
    BookingSvc[booking-service] --> DB_Booking
    CartSvc[cart-service] --> DB_Cart
    PaymentSvc[payment-service] --> DB_Payment
    WalletSvc[wallet-service] --> DB_Wallet
    NotifSvc[notification-service] --> DB_Notification
    ContentSvc[content-service] --> DB_Content
```

| Service | Database Name | Collections Owned |
|---|---|---|
| `auth-service` | `getready_auth` | `refresh_tokens`, `otps` |
| `user-service` | `getready_user` | `users`, `addresses`, `members`, `roles`, `permissions` |
| `beautician-service` | `getready_beautician` | `beautician_profiles`, `bank_details`, `skills` |
| `catalog-service` | `getready_catalog` | `categories`, `services`, `service_change_requests`, `packages`, `filters`, `hygiene_kits` |
| `booking-service` | `getready_booking` | `bookings`, `outbox_events`, `idempotencies` |
| `cart-service` | `getready_cart` | `carts` |
| `payment-service` | `getready_payment` | `payments`, `idempotencies` |
| `wallet-service` | `getready_wallet` | `wallets`, `wallet_transactions`, `loyalty_rules`, `idempotencies` |
| `notification-service` | `getready_notification` | `notifications`, `idempotencies` |
| `content-service` | `getready_content` | `banners`, `blogs` |
