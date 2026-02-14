---
paths:
  - "src/index.ts"
  - "src/schemas.ts"
---

- Use `McpServer.tool()`/tool registration patterns with Zod schemas from `src/schemas.ts`.
- For tools that accept optional `companyId`, fall back to `FREEE_DEFAULT_COMPANY_ID`; otherwise return a clear error.
- Tool handlers should return `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.
- Keep the `registerTool` wrapper in `src/index.ts` as the TS2589 workaround for repeated tool registrations.
