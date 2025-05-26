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

This is a Model Context Protocol (MCP) server that integrates with the freee accounting API. The architecture follows a modular design:

### Core Components

1. **Entry Point** (`src/index.ts`):
   - Initializes the MCP server with freee API capabilities
   - Registers all available tools for interacting with freee services
   - Handles OAuth token management and API request routing
   - Implements resource handlers for company data access

2. **Authentication** (`src/auth/tokenManager.ts`):
   - Manages OAuth 2.0 tokens with automatic persistence
   - Handles token expiration and refresh logic
   - Stores tokens per company ID for multi-company support
   - Token data includes expiration tracking for proactive refresh

3. **API Client** (`src/api/freeeClient.ts`):
   - Axios-based HTTP client with interceptors for authentication
   - Automatic token injection and refresh on 401 responses
   - Implements all freee API endpoints (companies, deals, invoices, financial reports)
   - **Financial Report APIs**: Efficient access to P&L, balance sheet, cash flow data
   - Error handling with proper API error message extraction and token management

4. **Schema Validation** (`src/schemas.ts`):
   - Zod schemas for all tool inputs
   - Ensures type safety for API parameters
   - Validates required fields and data formats

5. **Type Definitions** (`src/types/freee.ts`):
   - TypeScript interfaces for all freee API entities
   - Ensures type safety throughout the application

### Key Design Patterns

- **Token Management**: Tokens are automatically refreshed 5 minutes before expiry
- **Company Context**: Most operations require a `companyId` parameter (with optional default)
- **Error Recovery**: Failed auth attempts trigger token refresh before retry
- **Tool Organization**: Tools are grouped by resource type (auth, company, deal, reports, etc.)
- **Efficiency Focus**: Financial reports provide aggregated data to avoid processing thousands of transactions
- **API Rate Limiting**: Report APIs minimize API calls for better performance and rate limit compliance

### freee API Integration Details

- **Base URL**: `https://api.freee.co.jp/api/1`
- **Auth URL**: `https://accounts.secure.freee.co.jp`
- **OAuth Flow**: Authorization Code Grant with refresh token support
- **Rate Limits**: 3,600 requests/hour per app

### Environment Configuration

Required environment variables:
- `FREEE_CLIENT_ID`: OAuth application client ID
- `FREEE_CLIENT_SECRET`: OAuth application client secret
- `FREEE_REDIRECT_URI`: OAuth redirect URI (default: `urn:ietf:wg:oauth:2.0:oob`)
- `TOKEN_STORAGE_PATH`: Path to store OAuth tokens (optional)
- `FREEE_DEFAULT_COMPANY_ID`: Default company ID to use when not specified (optional)

## Troubleshooting Guide

### Common Issues & Solutions

#### Authentication Problems
- **Invalid Grant Error**: Refresh tokens are single-use in freee API. Re-run `npm run setup-auth` to get new tokens
- **Token Expiry**: Server automatically refreshes tokens 5 minutes before expiration. Check token file timestamps
- **Multiple Companies**: Ensure you're using the correct company ID or set `FREEE_DEFAULT_COMPANY_ID`

#### CI/CD Failures
- **Missing Jest Types**: Ensure `@types/jest` is installed for TypeScript test compilation
- **License Checker Issues**: Some dependencies may have incompatible licenses (e.g., argparse with Python-2.0)
- **Node.js Version Conflicts**: Use Node.js 20+ as specified in package.json engines field
- **Dependency Conflicts**: Check `npm ls` for version mismatches, especially with lint-staged versions

#### Development Environment
- **Build Failures**: Run `npm run typecheck` to identify TypeScript issues before building
- **Test Failures**: Ensure all external dependencies are properly mocked in unit tests
- **Linting Errors**: Use `npm run lint -- --fix` to automatically resolve style issues
- **Pre-commit Hook Issues**: Verify husky setup and lint-staged configuration

#### API Integration Issues  
- **Rate Limiting**: Use aggregated APIs like `freee_get_profit_loss` instead of individual transaction queries
- **Response Format Changes**: freee API sometimes returns objects vs arrays - validate response structure
- **401 Errors**: Check token validity and automatic refresh logic in interceptors
- **Company ID Missing**: Most operations require company ID - either pass explicitly or set default

#### Performance Optimization
- **Slow Profit Calculations**: Use `freee_get_profit_loss` API (1 call) instead of aggregating transactions (thousands of calls)
- **Memory Usage**: Mock file system operations in tests to avoid creating actual files
- **Rate Limit Consumption**: Monitor API usage - financial reports consume minimal rate limits vs individual queries