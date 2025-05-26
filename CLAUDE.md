# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Build**: `npm run build` - Compiles TypeScript code to JavaScript in the `dist/` directory
- **Development**: `npm run dev` - Starts the development server with hot reload using tsx
- **Start**: `npm start` - Runs the compiled JavaScript from `dist/index.js`
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files in the `src/` directory
- **Type Check**: `npm run typecheck` - Performs TypeScript type checking without emitting files
- **Test**: `npm test` - Runs the Jest test suite

## Recent Changes

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
   - Implements all freee API endpoints (companies, deals, invoices, etc.)
   - Error handling with proper API error message extraction

4. **Schema Validation** (`src/schemas.ts`):
   - Zod schemas for all tool inputs
   - Ensures type safety for API parameters
   - Validates required fields and data formats

5. **Type Definitions** (`src/types/freee.ts`):
   - TypeScript interfaces for all freee API entities
   - Ensures type safety throughout the application

### Key Design Patterns

- **Token Management**: Tokens are automatically refreshed 5 minutes before expiry
- **Company Context**: Most operations require a `companyId` parameter
- **Error Recovery**: Failed auth attempts trigger token refresh before retry
- **Tool Organization**: Tools are grouped by resource type (auth, company, deal, etc.)

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