# API Overview

## Base URL

`/api/v1`

Interactive OpenAPI UI (when enabled): `/api-docs`

## Auth

- JWT **Bearer** access tokens (`Authorization: Bearer <token>`)
- Obtain token via `POST /api/v1/users/login`

CSRF protection is **not** applied to Bearer JWT APIs. If you add cookie-based session auth, enable CSRF on those routes only.

## Response envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 1 }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

## Sample endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/users` | Create user |
| POST | `/api/v1/users/login` | Login |
| GET | `/api/v1/users` | List users (paginated) |
| GET | `/api/v1/users/:id` | Get user |
| PATCH | `/api/v1/users/:id` | Update user |
| DELETE | `/api/v1/users/:id` | Soft-delete user |
| GET | `/api/v1/notifications` | List my notifications (stub) |

## Correlation

All responses include `x-request-id`. Clients may send their own `x-request-id` header.
