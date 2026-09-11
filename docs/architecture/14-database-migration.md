# 14 - Database Migration Strategy & Data Isolation

## Migration Strategy (Strangler Fig Pattern)

To achieve zero downtime and prevent data corruption, existing collections in the legacy monolith MongoDB database are migrated to their corresponding microservice databases using an incremental dual-read/dual-write or offline split script.

```mermaid
flowchart LR
    subgraph Monolith DB
        OldDB[(salon / getready)]
    end

    subgraph Split Process
        MigScript[Data Migration Script]
    end

    subgraph Target Isolated DBs
        DB_Auth[(getready_auth)]
        DB_User[(getready_user)]
        DB_Beautician[(getready_beautician)]
        DB_Catalog[(getready_catalog)]
        DB_Booking[(getready_booking)]
        DB_Cart[(getready_cart)]
        DB_Payment[(getready_payment)]
        DB_Wallet[(getready_wallet)]
        DB_Notif[(getready_notification)]
        DB_Content[(getready_content)]
    end

    OldDB --> MigScript
    MigScript -->|users, addresses, members, roles| DB_User
    MigScript -->|beautician_profiles, skills| DB_Beautician
    MigScript -->|categories, services, packages| DB_Catalog
    MigScript -->|bookings| DB_Booking
    MigScript -->|carts| DB_Cart
    MigScript -->|wallets, transactions| DB_Wallet
    MigScript -->|notifications| DB_Notif
    MigScript -->|banners, blogs| DB_Content
```

## Migration Validation Checklist
- Verify document counts between source and destination collections.
- Ensure all indexes and unique constraints (`email`, `phone`, `slug`, `orderId`) exist in target databases.
- Test read and write consistency before cutting over traffic from the API Gateway.
