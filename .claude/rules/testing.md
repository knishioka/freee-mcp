---
paths:
  - "src/__tests__/**/*.ts"
---

- Mock `fs`, `axios`, `crypto`, and all other external dependencies used by the unit under test.
- Never make real API calls in tests; all network and file operations must be mocked.
- Keep `@types/jest` installed and configured for TypeScript test type support.
