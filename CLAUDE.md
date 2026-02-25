# CLAUDE.md

Guidance for AI coding agents working in this repository. Keep this file concise and avoid duplicating `README.md`.

## Commands

- `npm run build`: Compile TypeScript into `dist/`
- `npm run dev`: Run local development server with `tsx watch`
- `npm start`: Run compiled server from `dist/index.js`
- `npm run lint`: Lint `src/**/*.ts` with ESLint
- `npm run typecheck`: TypeScript checks without emit
- `npm test`: Run Jest tests
- `npm run setup-auth`: Run OAuth setup helper script

## Code Style

- Follow existing TypeScript patterns and ESLint rules.
- Use 2-space indentation, single quotes, and semicolons.
- Avoid adding new `any` unless required by an external typing limitation.
- Keep changes minimal and scoped to the issue.

### Pre-commit Hook Process

The commit is blocked unless all `lint-staged` checks pass:

1. `eslint --fix` on staged `src/**/*.{ts,tsx}`
2. `npm run typecheck`
3. `gitleaks detect --source . --verbose --no-banner --redact`

## Architecture

This project is an MCP server for freee accounting APIs.

| File                       | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `src/index.ts`             | MCP server bootstrap, env validation, tool registration, request handling |
| `src/api/freeeClient.ts`   | Axios clients, auth interceptors, token refresh and retry behavior        |
| `src/auth/tokenManager.ts` | Encrypted token persistence and expiry checks per company                 |
| `src/schemas.ts`           | Zod input schemas for tools                                               |
| `src/types/freee.ts`       | Type definitions for freee entities and API payloads                      |

### MCP SDK 1.x Tool Registration Pattern

- Keep `McpServer` initialization and capability structure aligned with current SDK 1.x usage.
- Keep the local `registerTool(...)` wrapper in `src/index.ts`; it intentionally avoids TS2589 inference blowups from cumulative Zod-heavy registrations.
- Register tools through this wrapper to preserve runtime behavior and compile stability.

### Token Refresh Architecture (Do Not Break)

- Keep pre-request expiry checks and 401 retry flow in `src/api/freeeClient.ts`.
- Preserve Promise dedup with `refreshPromises: Map<number, Promise<void>>` and `refreshTokenWithLock(...)` to avoid concurrent refresh races.
- Keep single retry guard (`__retried`) to prevent infinite 401 loops.
- Keep `invalid_grant` handling that removes invalid tokens and prompts re-authentication.

## Adding a New Tool

1. **Define the schema** in `src/schemas.ts` — plain object with Zod fields (not `z.object()`), reuse `companyIdField` for optional company ID, add `.describe()` on every field
2. **Add types** (if needed) in `src/types/freee.ts` for any new freee API response shapes
3. **Add the API method** in `src/api/freeeClient.ts` if the endpoint is not already covered
4. **Register the tool** in `src/index.ts` using the `registerTool` wrapper with `try/catch` → `handleToolError`
5. **Add tests** in `src/__tests__/` — mock `FreeeClient` and `TokenManager`, assert on MCP response structure
6. **Verify** before committing: `npm run typecheck && npm test && npm run lint`

See `.claude/rules/adding-tools.md` for the full pattern reference and `.claude/rules/testing.md` for mock examples.

## Key Constraints (freee-specific)

- freee refresh tokens are single-use; never issue parallel refreshes for the same company.
- freee API rate limit is 3,600 requests/hour; prefer aggregated report endpoints (e.g., freee_get_profit_loss) over high-volume transaction scans.
- freee error/data formats can vary by endpoint; keep defensive parsing and explicit error messaging.

## Common Bug Patterns

- **No `any` for freee responses** — use types from `src/types/freee.ts`; avoid `any` unless required by an external typing limitation.
- **Defensive `response.data` handling** — freee response shapes can vary by endpoint; validate structure before reading nested fields.
- **No parallel token refreshes** — use `refreshTokenWithLock(...)` and the `refreshPromises` Map to deduplicate per-company refreshes. See `.claude/rules/token-management.md`.
- **Single-use refresh tokens** — never retry with the same refresh token after use; `invalid_grant` means the token is consumed and the user must re-authenticate.
