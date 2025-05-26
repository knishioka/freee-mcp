# Contributing to freee MCP

## Coding Standards

### Naming Conventions

#### Files
- **Source files**: Use camelCase (e.g., `tokenManager.ts`, `freeeClient.ts`)
- **Test files**: Use pattern `<filename>.test.ts` in `__tests__` directory
- **Type files**: Place in `types/` directory with descriptive names
- **Scripts**: Use kebab-case for executable scripts (e.g., `setup-auth.js`)

#### Variables and Functions
- **Variables/Functions**: camelCase (e.g., `getToken`, `clientId`)
- **Classes/Interfaces**: PascalCase (e.g., `TokenManager`, `FreeeClient`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `MAX_RETRIES`)
- **API Parameters**: snake_case to match freee API (e.g., `company_id`, `access_token`)
- **Private members**: Prefix with `private` keyword, no underscore

#### Test Variables
- **Mocks**: Prefix with `mock` (e.g., `mockClient`, `mockTokenResponse`)
- **Test data**: Use descriptive names (e.g., `validTokenData`, `expiredTokenResponse`)

### Import Organization

Order imports as follows:
```typescript
// 1. Node.js built-in modules
import path from 'path';

// 2. External packages
import axios from 'axios';
import { z } from 'zod';

// 3. Internal types/interfaces
import { FreeeClient } from '../types/freee.js';

// 4. Internal modules
import { TokenManager } from '../auth/tokenManager.js';

// 5. Relative imports
import { helper } from './utils.js';
```

### Test Conventions

#### Test Descriptions
Use BDD-style descriptions:
```typescript
// Good
describe('when fetching companies', () => {
  it('returns the company list with valid token', async () => {});
  it('throws an error when token is invalid', async () => {});
});

// Avoid
describe('getCompanies', () => {
  it('should work', async () => {});
});
```

#### Test Organization
- Group related tests with `describe` blocks
- Use `beforeEach` for common setup
- Keep tests focused on single behaviors
- Name test data clearly

### Error Handling

- Always include context in error messages
- Use custom error types for domain-specific errors
- Log errors with appropriate severity levels
- Provide actionable error messages

### Code Style

- Use `const` by default, `let` only when reassignment is needed
- Prefer async/await over promise chains
- Use early returns to reduce nesting
- Keep functions small and focused
- Add JSDoc comments for public APIs

### TypeScript

- Avoid `any` type except in tests and external library integrations
- Define interfaces for all API responses
- Use strict mode
- Prefer type inference when obvious

### Pull Request Guidelines

1. Write clear commit messages
2. Include tests for new features
3. Update documentation as needed
4. Run `npm run lint` and `npm run typecheck` before submitting
5. Ensure all tests pass with `npm test`