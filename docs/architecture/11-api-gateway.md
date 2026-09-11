# 11 - API Gateway Architecture & Route Catalog

## Overview
The API Gateway serves as the single unified entry point for mobile applications (iOS/Android) and the Admin web portal. It enforces security headers, token verification, correlation ID tracking, rate limiting, and reverse-proxy routing.

```mermaid
flowchart TD
    Client[Client Request] --> Gateway[API Gateway :8080]

    subgraph Gateway Pipeline
        H1[Security Headers / Helmet]
        H2[Correlation ID & Request ID]
        H3[Structured Pino Logging]
        H4[Prometheus Metrics Middleware]
        H5[JWT Auth Guard / Token Extraction]
        H6[Reverse Proxy Router]
        H1 --> H2 --> H3 --> H4 --> H5 --> H6
    end

    Gateway --> Gateway Pipeline
    H6 -->|/api/v1/auth/*| S1[auth-service:3001]
    H6 -->|/api/v1/users/*| S2[user-service:3002]
    H6 -->|/api/v1/beautician-profiles/*| S3[beautician-service:3003]
    H6 -->|/api/v1/services/*, /categories/*| S4[catalog-service:3004]
    H6 -->|/api/v1/bookings/*, /slots/*| S5[booking-service:3005]
    H6 -->|/api/v1/cart/*| S6[cart-service:3006]
    H6 -->|/api/v1/payments/*| S7[payment-service:3007]
    H6 -->|/api/v1/wallet/*| S8[wallet-service:3008]
    H6 -->|/api/v1/notifications/*| S9[notification-service:3009]
    H6 -->|/api/v1/banners/*, /blogs/*| S10[content-service:3010]
```

## Backward Compatibility Guarantee
All paths used by the mobile application and admin web console are 100% backward compatible with identical request payloads, headers, query parameters, and standardized response envelopes (`success: true, data: ..., message: ...`).
