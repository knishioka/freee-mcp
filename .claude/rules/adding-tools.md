---
paths:
  - "src/index.ts"
  - "src/schemas.ts"
  - "src/types/freee.ts"
---

## registerTool Wrapper

All tools are registered through a local `registerTool` wrapper in `src/index.ts` that avoids TS2589 type-depth blowups. Do NOT call `server.registerTool()` directly.

```typescript
// Signature (defined in src/index.ts — do not modify)
function registerTool(
  name: string,
  config: { description: string; inputSchema?: Record<string, z.ZodTypeAny> },
  handler: (args: any) => Promise<CallToolResult>,
): void;
```

### Full Tool Registration Example

```typescript
registerTool(
  "freee_get_example",
  {
    description: "Get example resources for a company",
    inputSchema: schemas.GetExampleSchema,
  },
  async ({ companyId, offset, limit }) => {
    try {
      const data = await freeeClient.getExamples(getCompanyId(companyId), {
        offset,
        limit,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError("freee_get_example", error);
    }
  },
);
```

## Schema Conventions (`src/schemas.ts`)

- Schemas are **plain objects** (`Record<string, z.ZodTypeAny>`), NOT wrapped in `z.object()`.
- Every field MUST have `.describe()` with a human-readable description.
- Tool names use `freee_` prefix with snake_case.
- Reuse `companyIdField` for the optional company ID parameter.
- Reuse `optionalDateField(description)` and `dateField(description)` for date parameters.

```typescript
export const GetExampleSchema = {
  companyId: companyIdField,
  startDate: optionalDateField("Start date (YYYY-MM-DD)"),
  offset: z.number().min(0).optional().describe("Pagination offset"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of results (1-100)"),
};
```

## Error Handling

All tool handlers MUST use `try/catch` with `handleToolError`:

```typescript
async (args) => {
  try {
    // ... implementation
  } catch (error) {
    handleToolError("freee_tool_name", error);
  }
};
```

`handleToolError` re-throws `McpError` as-is and wraps other errors in `McpError(ErrorCode.InternalError, ...)`.

## Company ID Resolution

Use `getCompanyId(companyId)` to resolve the optional company ID. It falls back to `FREEE_DEFAULT_COMPANY_ID` and throws `McpError(ErrorCode.InvalidParams, ...)` if neither is available.

## Response Format

Tool handlers always return:

```typescript
{
  content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
}
```

For formatted output, use `ResponseFormatter` methods (e.g., `ResponseFormatter.formatDeals(deals, compact)`).

## Optional vs Required Parameters

- **Required**: use `z.number().describe(...)` or `z.string().describe(...)`
- **Optional**: add `.optional()` before `.describe(...)`: `z.number().optional().describe(...)`
- **Company ID**: always optional — use the shared `companyIdField`
