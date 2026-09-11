# 04 — Admin Permission Matrix (RBAC)

## 1. System Roles

1. **Super Admin**: Full administrative rights across all services, system settings, RBAC definitions, and financial operations.
2. **Operations Admin**: Manages bookings, slot capacities, beautician allocations, KYC verifications, and real-time dispatch.
3. **Finance Admin**: Manages payments, gateway refunds, wallet ledger reconciliations, payout settlements, and financial audits.
4. **Catalog & Marketing Manager**: Manages services, category hierarchies, upgrade rules, package bundles, banners, blogs, and coupons.
5. **Customer Support Agent**: Read-only access to customer profiles, bookings, and Beauty Passports; can initiate support tickets and customer contact.

---

## 2. Granular Permissions Map

| Resource | Permission Key | Allowed Roles | Description |
|---|---|---|---|
| **Dashboard** | `dashboard:view` | Super Admin, Operations Admin, Finance Admin, Catalog Manager, Support Agent | Access aggregated performance metrics |
| **Operations** | `operations:view` | Super Admin, Operations Admin | Real-time dispatch, queue status, active beauticians |
| **Bookings** | `bookings:view` | Super Admin, Operations Admin, Finance Admin, Support Agent | View booking lists and details |
| | `bookings:assign` | Super Admin, Operations Admin | Assign / Reassign beauticians to bookings |
| | `bookings:cancel` | Super Admin, Operations Admin | Cancel booking with optional fee waiver |
| **Customers** | `users:view` | Super Admin, Operations Admin, Support Agent | View customer profiles and spending |
| | `users:manage` | Super Admin, Operations Admin | Modify customer status, freeze account |
| **Beauticians**| `beauticians:view`| Super Admin, Operations Admin, Support Agent | View beautician directory |
| | `beauticians:edit`| Super Admin, Operations Admin | Approve KYC, adjust skills, update availability |
| **Catalog** | `services:manage` | Super Admin, Catalog Manager | Create / Edit / Archive services and upgrade rules |
| | `categories:manage`| Super Admin, Catalog Manager | Create / Reorder categories |
| | `packages:manage` | Super Admin, Catalog Manager | Create / Edit service package bundles |
| **Finances** | `payments:view` | Super Admin, Finance Admin | View payment records |
| | `payments:refund`| Super Admin, Finance Admin | Issue full or partial payment refunds |
| | `wallets:view` | Super Admin, Finance Admin, Support Agent | Inspect customer wallet ledger |
| | `wallets:adjust` | Super Admin, Finance Admin | Post auditable manual wallet credits/debits |
| **Growth & CMS**| `coupons:manage` | Super Admin, Catalog Manager | Create / Expire coupon codes |
| | `banners:manage` | Super Admin, Catalog Manager | Publish app / web promo banners |
| | `cms:manage` | Super Admin, Catalog Manager | Publish blogs, policies, and FAQs |
| | `notifications:manage`| Super Admin, Operations Admin | Trigger broadcast notifications |
| **System** | `settings:manage` | Super Admin | Modify runtime booking settings, upgrade thresholds, and hygiene kit pricing |
| | `roles:manage` | Super Admin | Manage RBAC roles and permissions |
| | `system:view` | Super Admin, Operations Admin | View Prometheus, Grafana, Loki, RabbitMQ metrics |
