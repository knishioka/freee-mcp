---
paths:
  - "src/__tests__/**/*.ts"
---

- Mock `fs`, `axios`, `crypto`, and all other external dependencies used by the unit under test.
- Never make real API calls in tests; all network and file operations must be mocked.
- Keep `@types/jest` installed and configured for TypeScript test type support.

## Mocking FreeeClient for Tool Handler Tests

Tool handlers in `src/index.ts` are anonymous functions passed to `registerTool`, so they cannot be imported directly. Tests mock the `FreeeClient` class and verify that client methods are called with correct arguments and return expected data. Use this pattern (see `src/__tests__/handlers.test.ts`):

```typescript
import { jest } from "@jest/globals";
import { FreeeClient } from "../api/freeeClient.js";
import { TokenManager } from "../auth/tokenManager.js";

jest.mock("../api/freeeClient.js");
jest.mock("../auth/tokenManager.js");

describe("Tool Handlers", () => {
  let mockClient: any;
  let mockTokenManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      getDeals: jest.fn(),
      // Add methods your tool calls
    };

    mockTokenManager = {
      loadTokens: jest.fn(),
      saveTokens: jest.fn(),
      setToken: jest.fn(),
      getToken: jest.fn(),
      getAllCompanyIds: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenExpiryStatus: jest.fn(),
    };

    (FreeeClient as jest.MockedClass<typeof FreeeClient>).mockImplementation(
      () => mockClient,
    );
    (TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager,
    );
  });

  it("should call client with correct params and return formatted data", async () => {
    const mockDeals = { deals: [{ id: 1, amount: 1000 }] };
    mockClient.getDeals.mockResolvedValue(mockDeals);

    // Call the client as the tool handler would
    const result = await mockClient.getDeals(123, { offset: 0, limit: 10 });

    // Verify correct arguments were passed
    expect(mockClient.getDeals).toHaveBeenCalledWith(123, {
      offset: 0,
      limit: 10,
    });
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0]).toMatchObject({ id: 1, amount: 1000 });
  });

  it("should handle API errors", async () => {
    mockClient.getDeals.mockRejectedValue(new Error("API Error"));

    await expect(mockClient.getDeals(123, {})).rejects.toThrow("API Error");
  });
});
```

## Mocking Axios for FreeeClient Tests

Use this pattern when testing `FreeeClient` itself (see `src/__tests__/api/freeeClient.test.ts`):

```typescript
import { jest } from "@jest/globals";
import axios from "axios";
import type { AxiosError as AxiosErrorType } from "axios";

// Get real AxiosError for instanceof checks (jest.mock replaces it with a stub)
const { AxiosError: RealAxiosError, AxiosHeaders: RealAxiosHeaders } =
  jest.requireActual<typeof import("axios")>("axios");

function createAxiosError(
  responseData: Record<string, unknown>,
  message = "Request failed",
): AxiosErrorType {
  return new RealAxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    data: responseData,
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers: new RealAxiosHeaders() },
  });
}

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;
```

## Testing Error Cases

```typescript
// 401 Unauthorized
mockClient.getDeals.mockRejectedValue(
  createAxiosError({ message: "Unauthorized" }),
);

// Network error
mockClient.getDeals.mockRejectedValue(new Error("Network Error"));
```

## MCP Tool Response Assertion

Tool handlers return `{ content: [{ type: 'text', text: string }] }`. Assert on the parsed text:

```typescript
const result = await handler({ companyId: 123 });
expect(result.content).toHaveLength(1);
expect(result.content[0].type).toBe("text");
const data = JSON.parse(result.content[0].text);
expect(data).toMatchObject({
  /* expected shape */
});
```

## Test File Locations

- Tool handler tests: `src/__tests__/handlers.test.ts`
- FreeeClient tests: `src/__tests__/api/freeeClient.test.ts`
- TokenManager tests: `src/__tests__/auth/tokenManager.test.ts`
- Schema tests: `src/__tests__/schemas.test.ts`
- New tool tests: `src/__tests__/<name>.test.ts` or `src/__tests__/api/<name>.test.ts`
