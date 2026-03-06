---
name: add-freee-tool
description: "Automates the standard workflow for adding a new freee MCP tool"
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
argument-hint: "<tool_name> [endpoint_path]"
---

# Add freee Tool Skill

Automates the 7-step workflow for adding a new MCP tool to the freee-mcp project.

## Usage

```
/add-freee-tool freee_get_xxx
/add-freee-tool freee_create_xxx /api/1/xxx
```

The argument should be the tool name (e.g., `freee_get_deals`) and optionally the freee API endpoint path.

## Workflow

### Step 1: Endpoint Confirmation

Check if the endpoint exists in the OpenAPI spec:

```bash
SPEC="$(git rev-parse --show-toplevel)/openapi/minimal/accounting.json"
```

If the file exists, search for the endpoint path:

```bash
cat "$SPEC" | jq '.paths["<endpoint_path>"]'
```

Extract: HTTP method, path parameters, query parameters, response schema.

**If the spec file does not exist**: warn the user that `openapi/minimal/accounting.json` is not available, then ask the user to provide the endpoint details (path, method, parameters, response fields) or reference the [freee API documentation](https://developer.freee.co.jp/docs/accounting/reference). Do NOT abort — proceed with user-provided or documentation-based information.

**If the endpoint is not found in the spec**: warn the user and confirm whether to proceed.

### Step 2: Add Type Definition

**File**: `src/types/freee.ts`

Add a `FreeeXxx` interface matching the API response structure. Follow snake_case matching the freee API JSON keys.

**Pattern reference** — read existing interfaces in the file for conventions:

```typescript
export interface FreeeXxx {
  id: number;
  company_id: number;
  name: string;
  // Match freee API response field names (snake_case)
  // Use ? for optional fields
  created_at?: string;
  updated_at?: string;
}
```

Key conventions:

- Interface name: `FreeeXxx` (PascalCase with `Freee` prefix)
- Properties: `snake_case` matching API response
- Optional properties marked with `?`
- Use `number`, `string`, `boolean`, and nested interfaces as appropriate

### Step 3: Add Client Method

**File**: `src/api/freeeClient.ts`

Add a method to the `FreeeClient` class. Read the file first to understand existing patterns.

**Pattern reference:**

```typescript
async getXxx(companyId: number, params?: { offset?: number; limit?: number }): Promise<{ xxx: FreeeXxx[] }> {
  const response = await this.api.get<{ xxx: FreeeXxx[] }>(`/api/1/xxx`, {
    params: {
      company_id: companyId,
      ...params,
    },
  });
  return response.data;
}
```

Key conventions:

- Method name: `getXxx` / `createXxx` / `updateXxx` / `deleteXxx`
- First param is always `companyId: number`
- Use `this.api.get/post/put/delete` (Axios instance with auth interceptors)
- Return `response.data`
- For cached endpoints, check existing cache patterns (`ApiCache`, `CACHE_TTL_*`)
- Import the type from `../types/freee.js` if not already imported

### Step 4: Add Zod Schema

**File**: `src/schemas.ts`

Add a schema as a plain object (NOT `z.object()`). Read the file first to see `companyIdField`, `optionalDateField`, and other shared helpers.

**Pattern reference:**

```typescript
export const GetXxxSchema = {
  companyId: companyIdField,
  offset: z.number().min(0).optional().describe("Pagination offset"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of results (1-100)"),
};
```

Key conventions:

- Schema name: `GetXxxSchema` / `CreateXxxSchema` (PascalCase)
- Type: `Record<string, z.ZodTypeAny>` (plain object, NOT `z.object()`)
- Every field MUST have `.describe()` with human-readable description
- Reuse `companyIdField` for optional company ID
- Reuse `optionalDateField(description)` and `dateField(description)` for dates
- Optional fields: `.optional()` before `.describe()`

### Step 5: Register Tool

**File**: `src/index.ts`

Use the `registerTool` wrapper (NOT `server.registerTool()`). Read the file first to find the registration section.

**Pattern reference:**

```typescript
registerTool(
  "freee_get_xxx",
  {
    description: "Get xxx resources for a company",
    inputSchema: schemas.GetXxxSchema,
  },
  async ({ companyId, offset, limit }) => {
    try {
      const data = await freeeClient.getXxx(getCompanyId(companyId), {
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
      handleToolError("freee_get_xxx", error);
    }
  },
);
```

Key conventions:

- Tool name: `freee_` prefix with `snake_case`
- Always use `try/catch` with `handleToolError`
- Use `getCompanyId(companyId)` to resolve optional company ID
- Return `{ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }`
- For formatted output, use `ResponseFormatter` methods if applicable

### Step 6: Add Tests

Add tests in the following locations:

#### 6a. Schema Existence Test

**File**: `src/__tests__/handlers.test.ts`

Find the `expectedSchemas` array in the `'Tool Schema Validation'` describe block and add the new schema export name (NOT the tool name):

```typescript
const expectedSchemas = [
  // ... existing schemas
  "GetXxxSchema", // Add the schema export name (PascalCase), NOT the tool name
];
```

Also add the new client method to the `mockClient` object in `beforeEach`.

#### 6b. Client Method Test

**File**: `src/__tests__/api/freeeClient.test.ts`

Add a describe block for the new method:

```typescript
describe("getXxx", () => {
  it("should fetch xxx with correct parameters", async () => {
    const mockResponse = { xxx: [{ id: 1, name: "Test" }] };
    mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

    const result = await client.getXxx(123, { offset: 0, limit: 10 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/1/xxx", {
      params: { company_id: 123, offset: 0, limit: 10 },
    });
    expect(result).toEqual(mockResponse);
  });
});
```

#### 6c. Schema Validation Test

**File**: `src/__tests__/schemas.test.ts`

Add validation tests using `safeParse` to verify schema constraints. Read the existing test file first to follow its patterns:

```typescript
describe("GetXxxSchema validation", () => {
  const schema = z.object(schemas.GetXxxSchema);

  it("should accept valid input", () => {
    const result = schema.safeParse({ companyId: 123 });
    expect(result.success).toBe(true);
  });

  it("should accept optional fields", () => {
    const result = schema.safeParse({
      companyId: 123,
      offset: 0,
      limit: 10,
    });
    expect(result.success).toBe(true);
  });
});
```

### Step 7: Verify

Run all checks to ensure nothing is broken:

```bash
npm run typecheck && npm run lint && npm test
```

If any step fails, fix the issues before proceeding. Common issues:

- Missing imports in `src/api/freeeClient.ts` or `src/index.ts`
- Schema fields without `.describe()`
- Type mismatches between the interface and API response
- Missing mock methods in test files

## Reference Files

| Step | File                                    | Purpose                           |
| ---- | --------------------------------------- | --------------------------------- |
| 1    | `openapi/minimal/accounting.json`       | API endpoint spec (may not exist) |
| 2    | `src/types/freee.ts`                    | Type definitions                  |
| 3    | `src/api/freeeClient.ts`                | API client methods                |
| 4    | `src/schemas.ts`                        | Zod input schemas                 |
| 5    | `src/index.ts`                          | Tool registration                 |
| 6a   | `src/__tests__/handlers.test.ts`        | Schema existence tests            |
| 6b   | `src/__tests__/api/freeeClient.test.ts` | Client method tests               |
| 6c   | `src/__tests__/schemas.test.ts`         | Schema validation tests           |
| 7    | `package.json`                          | Verification commands             |

## Rules Files

These rules are auto-loaded by path matching but are useful references:

- `.claude/rules/adding-tools.md` — Full `registerTool` pattern and schema conventions
- `.claude/rules/testing.md` — Mock patterns for FreeeClient and TokenManager
- `.claude/rules/mcp-tools.md` — Tool registration rules
- `.claude/rules/freee-api.md` — API constraints (single-use refresh tokens, rate limits)
