# 16 - Production Security Guidelines & Hardening

## Defense in Depth

```mermaid
flowchart TD
    Client[Untrusted Client Request] --> WAF[WAF / HTTPS / Helmet]
    WAF --> GW[API Gateway: JWT Verification & Rate Limiting]
    GW -->|Trusted Internal Network with x-user-id Header| Svc[Downstream Microservice]
    Svc --> AuthCheck[Resource-Level Authorization & RBAC Guard]
    Svc --> Redact[Pino Structured Logger with Secret Redaction]
    Svc --> SafeErr[Safe Standard Error Envelope - No Stack Traces]
```

## Security Best Practices Enforced
1. **Zero Secret Leakage**: Passwords, OTPs, JWT secrets, payment tokens, and database passwords are redacted from logs and error payloads.
2. **Network Isolation**: Microservices and databases are isolated within Docker bridge networks, only exposing API Gateway (`:8080`), Grafana (`:3000`), and Prometheus (`:9090`).
3. **Safe Error Formatting**: Internal database stack traces or SQL/Mongo details are never returned to end users.
