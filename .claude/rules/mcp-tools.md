---
paths:
  - "src/index.ts"
  - "src/schemas.ts"
---

- Use the `registerTool` wrapper in `src/index.ts` with Zod schemas from `src/schemas.ts`.
- For tools that accept optional `companyId`, fall back to `FREEE_DEFAULT_COMPANY_ID`; otherwise return a clear error.
- Tool handlers should return `{ content: [{ type: "text", text: string }] }`; for data results, use `JSON.stringify(result, null, 2)`.
- Keep the `registerTool` wrapper as the TS2589 workaround for repeated tool registrations.
