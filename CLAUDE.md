# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Build**: `npm run build` - Compiles TypeScript code to JavaScript in the `dist/` directory
- **Development**: `npm run dev` - Starts the development server with hot reload using tsx
- **Start**: `npm start` - Runs the compiled JavaScript from `dist/index.js`
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files in the `src/` directory with auto-fix support
- **Type Check**: `npm run typecheck` - Performs TypeScript type checking without emitting files
- **Test**: `npm test` - Runs the Jest test suite

## Code Quality & Development Guidelines

### Linting and Code Style

- **ESLint Configuration**: Project uses ESLint with TypeScript support for code quality
- **Pre-commit Hooks**: Automatic linting and type checking runs before each commit via husky and lint-staged
- **Code Style**: 2-space indentation, single quotes, semicolons required
- **Auto-fix**: Run `npm run lint -- --fix` to automatically fix linting issues

### Pre-commit Process

When committing changes, the following checks run automatically:

1. ESLint with auto-fix on staged TypeScript files
2. TypeScript type checking
3. If any check fails, the commit is blocked

### Development Notes

- Always run `npm run lint` and `npm run typecheck` before committing
- Use `npm run build` to verify compilation succeeds
- Follow existing code patterns and TypeScript best practices
- Avoid `any` types where possible (warnings are acceptable for external APIs)

### Implementation Tips & Best Practices

#### Authentication & Token Management

- **Refresh Token Limitation**: freee refresh tokens are single-use only - once used, they cannot be reused
- **Token Expiry Strategy**: Tokens are refreshed 5 minutes before expiration to prevent race conditions
- **Error Handling**: Always handle `invalid_grant` errors by prompting for re-authentication
- **Multiple Companies**: Store tokens per company ID to support multi-tenant scenarios

#### API Integration Best Practices

- **Rate Limit Awareness**: freee API has 3,600 requests/hour limit - use aggregated endpoints when possible
- **Efficient Data Access**: Use financial report APIs (`freee_get_profit_loss`) instead of aggregating individual transactions
- **Error Recovery**: Implement automatic token refresh on 401 responses with retry logic
- **API Response Validation**: Validate API response structure as freee sometimes returns different formats

#### Testing & Quality Assurance

- **Unit Testing**: Mock external dependencies (fs, axios) to avoid real API calls in tests
- **Type Safety**: Include `@types/jest` for proper TypeScript support in test files
- **CI/CD**: Ensure all dependencies are properly declared and compatible across Node.js versions
- **License Compliance**: Be aware of transitive dependencies with incompatible licenses (e.g., argparse with Python-2.0)

#### Dependency Management

- **Major Version Updates**: Test carefully when updating major versions (ESLint, TypeScript, MCP SDK)
- **Node.js Compatibility**: Maintain compatibility with Node.js 20+ as defined in package.json engines
- **Dependency Conflicts**: Use `npm ls` to check for version conflicts, especially with lint-staged and Node.js versions
- **Security Auditing**: Regularly run `npm audit` to check for vulnerabilities

#### Documentation & Internationalization

- **Language Consistency**: Keep all documentation in English for international accessibility
- **API Examples**: Provide clear examples with actual parameter values and expected outputs
- **Error Messages**: Include clear error messages with actionable guidance for users
- **Performance Notes**: Document performance implications of different approaches (individual vs aggregated APIs)

## Recent Changes

### CI/CD Infrastructure & Dependency Updates (2025/5/26)

- **GitHub Actions Modernization**: Updated all GitHub Actions to latest versions
  - `softprops/action-gh-release`: v1 → v2
  - `lycheeverse/lychee-action`: v1 → v2
  - `codecov/codecov-action`: v4 → v5
- **Test Infrastructure**: Added comprehensive Jest unit tests with 64.86% code coverage
  - Mock-based testing for TokenManager and FreeeClient classes
  - Proper TypeScript test support with `@types/jest`
- **Dependency Management**: Updated compatible dependencies while maintaining stability
  - axios: 1.6.5 → 1.9.0, dotenv: 16.3.1 → 16.5.0, typescript: 5.3.3 → 5.8.3
  - Kept major version updates (ESLint 9, TypeScript ESLint 8, MCP SDK 1.x) for future review
- **License Compliance**: Fixed CI failures by updating license checker to handle Python-2.0 licensed dependencies
- **Documentation**: Unified all documentation to English for international accessibility

### Financial Report APIs for Efficient Data Access (2025/1/26)

- Added comprehensive financial report APIs for efficient profit calculation
- `freee_get_profit_loss` - Get operating profit without aggregating thousands of transactions
- `freee_get_balance_sheet` - Get balance sheet data in aggregated format
- `freee_get_cash_flow` - Get cash flow statements efficiently
- Enhanced token error handling with proactive refresh and detailed logging

### Multiple Company Support (2025/1/26)

- Added `FREEE_DEFAULT_COMPANY_ID` environment variable support
- Made `companyId` parameter optional in all tools
- If no `companyId` is provided, tools will use the default company ID
- If neither is provided, tools will return an error with clear instructions

## Architecture Overview

This is a Model Context Protocol (MCP) server that integrates with the freee accounting API.

### Core Components

| File                       | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `src/index.ts`             | Entry point: MCP server initialization, tool registration, request routing |
| `src/auth/tokenManager.ts` | OAuth 2.0 token management with encryption, persistence, and auto-refresh  |
| `src/api/freeeClient.ts`   | Axios HTTP client with auth interceptors, all freee API endpoints          |
| `src/schemas.ts`           | Zod schemas for tool input validation                                      |
| `src/types/freee.ts`       | TypeScript interfaces for freee API entities                               |

## Troubleshooting Guide

### CI/CD Failures

- **Missing Jest Types**: Ensure `@types/jest` is installed for TypeScript test compilation
- **License Checker Issues**: Some dependencies may have incompatible licenses (e.g., argparse with Python-2.0)
- **Node.js Version Conflicts**: Use Node.js 20+ as specified in package.json engines field
- **Dependency Conflicts**: Check `npm ls` for version mismatches, especially with lint-staged versions

### Development Environment

- **Build Failures**: Run `npm run typecheck` to identify TypeScript issues before building
- **Test Failures**: Ensure all external dependencies are properly mocked in unit tests
- **Linting Errors**: Use `npm run lint -- --fix` to automatically resolve style issues
- **Pre-commit Hook Issues**: Verify husky setup and lint-staged configuration
