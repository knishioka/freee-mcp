---
paths:
  - "src/auth/**/*.ts"
  - "src/api/freeeClient.ts"
---

- Use Promise dedup with `refreshPromises: Map<number, Promise<void>>` to prevent concurrent refresh races per company.
- Request interceptor behavior: `expired` => await refresh before request; `near_expiry` => start refresh fire-and-forget.
- Response `401` handler must join an existing refresh promise or start one; never delete token state immediately on first 401.
- Token storage must use AES-256-GCM encryption and a random salt (persisted as a separate `*.salt` file).
