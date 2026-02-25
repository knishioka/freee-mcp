# MCP Server for freee Accounting API

[![CI](https://github.com/knishioka/freee-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/knishioka/freee-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/knishioka/freee-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/knishioka/freee-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides integration with freee accounting software API, enabling AI assistants to interact with accounting data.

## Features

- OAuth 2.0 authentication flow support
- Company management
- Transaction (Deal) operations
- Account items management
- Partner management
- Sections and Tags
- Invoice creation and management
- Trial balance reports
- Token persistence and automatic refresh

## Prerequisites

- Node.js 20 or higher
- freee API credentials (Client ID and Client Secret)
- freee account with API access

## Quick Start

Choose one of the following methods to get started:

### Option A: npx (no local build required)

Add the following to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "freee": {
      "command": "npx",
      "args": ["-y", "github:knishioka/freee-mcp"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id",
        "FREEE_CLIENT_SECRET": "your_client_secret",
        "FREEE_TOKEN_ENCRYPTION_KEY": "replace-with-strong-random-value"
      }
    }
  }
}
```

> **Note**: The first launch with `npx` may take 30–60 seconds while dependencies are downloaded and TypeScript is compiled. Subsequent launches will be faster.

### Option B: Local build

```bash
git clone https://github.com/knishioka/freee-mcp.git
cd freee-mcp
npm install && npm run build
```

```json
{
  "mcpServers": {
    "freee": {
      "command": "node",
      "args": ["/absolute/path/to/freee-mcp/dist/index.js"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id",
        "FREEE_CLIENT_SECRET": "your_client_secret",
        "FREEE_TOKEN_ENCRYPTION_KEY": "replace-with-strong-random-value"
      }
    }
  }
}
```

See the [Installation](#installation) section for detailed setup instructions including environment variables and additional MCP client configurations.

### Which method should I use?

| Use case                                | Recommended method |
| --------------------------------------- | ------------------ |
| Quick evaluation / no Node.js dev setup | npx                |
| Active development / offline use        | Local build        |

## Installation

1. Clone the repository:

```bash
git clone https://github.com/knishioka/freee-mcp.git
cd freee-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

4. Copy the environment example file and configure it:

```bash
cp .env.example .env
```

5. Edit `.env` with your freee API credentials:

```
FREEE_CLIENT_ID=your_client_id_here
FREEE_CLIENT_SECRET=your_client_secret_here
FREEE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
# TOKEN_STORAGE_PATH=./tokens.enc  # Optional: defaults to platform-specific secure path
```

## Configuration

### Getting freee API Credentials

1. Log in to your freee account
2. Go to the [freee App Store](https://app.secure.freee.co.jp/developers/apps)
3. Create a new application
4. Note down the Client ID and Client Secret
5. Set the redirect URI (use `urn:ietf:wg:oauth:2.0:oob` for local development)

### MCP Client Configuration

Build the server first (`npm run build`), then configure one of the clients below.

#### Environment Variables

| Variable                     | Required | Description                                                                                                                                                                                               | Default                                                    |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `FREEE_CLIENT_ID`            | Yes      | freee OAuth app client ID. The server exits on startup if this is missing.                                                                                                                                | —                                                          |
| `FREEE_CLIENT_SECRET`        | Yes      | freee OAuth app client secret. The server exits on startup if this is missing.                                                                                                                            | —                                                          |
| `FREEE_DEFAULT_COMPANY_ID`   | No       | Default company ID used when tool calls omit `companyId`.                                                                                                                                                 | —                                                          |
| `TOKEN_STORAGE_PATH`         | No       | Encrypted token storage file path.                                                                                                                                                                        | Platform-specific (`TokenManager.getDefaultStoragePath()`) |
| `FREEE_TOKEN_ENCRYPTION_KEY` | Yes      | Secret used to derive the AES-256-GCM key for token encryption. The server exits on startup if this is missing. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | —                                                          |
| `FREEE_TOKEN_DATA_BASE64`    | No       | Base64-encoded JSON of `[companyId, tokenData]` tuples loaded at startup.                                                                                                                                 | —                                                          |

<details>
<summary>Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` or `%APPDATA%\\Claude\\claude_desktop_config.json`)</summary>

```json
{
  "mcpServers": {
    "freee": {
      "command": "node",
      "args": ["/absolute/path/to/freee-mcp/dist/index.js"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id_here",
        "FREEE_CLIENT_SECRET": "your_client_secret_here",
        "TOKEN_STORAGE_PATH": "/absolute/path/to/freee-mcp/tokens.enc",
        "FREEE_DEFAULT_COMPANY_ID": "123456",
        "FREEE_TOKEN_ENCRYPTION_KEY": "replace-with-strong-random-value"
      }
    }
  }
}
```

</details>

<details>
<summary>Claude Code CLI</summary>

```bash
claude mcp add freee \
  -e 'FREEE_CLIENT_ID=your_client_id_here' \
  -e 'FREEE_CLIENT_SECRET=your_client_secret_here' \
  -e 'TOKEN_STORAGE_PATH=/absolute/path/to/freee-mcp/tokens.enc' \
  -e 'FREEE_DEFAULT_COMPANY_ID=123456' \
  -e 'FREEE_TOKEN_ENCRYPTION_KEY=replace-with-strong-random-value' \
  -- node /absolute/path/to/freee-mcp/dist/index.js
```

</details>

<details>
<summary>VS Code (`.vscode/mcp.json`)</summary>

```json
{
  "servers": {
    "freee": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id_here",
        "FREEE_CLIENT_SECRET": "your_client_secret_here",
        "TOKEN_STORAGE_PATH": "${workspaceFolder}/tokens.enc",
        "FREEE_DEFAULT_COMPANY_ID": "123456",
        "FREEE_TOKEN_ENCRYPTION_KEY": "replace-with-strong-random-value"
      }
    }
  }
}
```

</details>

<details>
<summary>Cursor (`~/.cursor/mcp.json`)</summary>

```json
{
  "mcpServers": {
    "freee": {
      "command": "node",
      "args": ["/absolute/path/to/freee-mcp/dist/index.js"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id_here",
        "FREEE_CLIENT_SECRET": "your_client_secret_here",
        "FREEE_TOKEN_DATA_BASE64": "base64-encoded-json",
        "FREEE_DEFAULT_COMPANY_ID": "123456",
        "FREEE_TOKEN_ENCRYPTION_KEY": "replace-with-strong-random-value"
      }
    }
  }
}
```

</details>

## Usage

### Authentication Methods

#### Method 1: Using Setup Script (Recommended)

Run the interactive setup script:

```bash
npm run setup-auth
```

This script will:

1. Load credentials from `.env` file if available
2. Check for existing tokens in `tokens.enc`
3. Open the authorization URL in your browser
4. Wait for you to authorize and get the code
5. Exchange the code for tokens immediately
6. Save tokens to `tokens.enc` or display environment variables

After running this script, use a file-based token configuration like the Claude Desktop or VS Code examples above.

#### Method 2: Environment Variables

If you already have tokens, provide them via environment variables (for example `FREEE_TOKEN_DATA_BASE64` in the Cursor example above).

#### Method 3: Manual Flow (Not Recommended)

1. Get the authorization URL:

```
Use tool: freee_get_auth_url
```

2. Visit the URL in a browser and authorize the application
3. Copy the authorization code from the redirect
4. Exchange the code for an access token:

```
Use tool: freee_get_access_token with code: "your_auth_code"
```

Note: The authorization code expires quickly, so this method often fails.

### Handling Multiple Companies

freee MCP supports multiple companies. When you authenticate, the server automatically obtains access to all companies associated with your freee account.

#### Setting a Default Company

To avoid specifying `companyId` for every API call, you can set a default company ID:

```json
{
  "env": {
    "FREEE_DEFAULT_COMPANY_ID": "123456"
  }
}
```

To find your company IDs, use the `freee_get_companies` tool after authentication.

#### Using Multiple Companies

If you don't set a default company ID, you must specify `companyId` for each API call:

```
// With default company ID set:
Use tool: freee_get_deals

// Without default company ID:
Use tool: freee_get_deals with companyId: 123456
```

### Available Tools

#### Authentication

- `freee_get_auth_url` - Get OAuth authorization URL
- `freee_get_access_token` - Exchange auth code for access token
- `freee_set_company_token` - Manually set token for a company

#### Company Operations

- `freee_get_companies` - List accessible companies
- `freee_get_company` - Get company details

#### Transaction (Deal) Operations

- `freee_get_deals` - List transactions
- `freee_get_deal` - Get transaction details
- `freee_create_deal` - Create new transaction

#### Master Data

- `freee_get_account_items` - List account items
- `freee_get_partners` - List partners
- `freee_create_partner` - Create new partner
- `freee_get_sections` - List sections
- `freee_get_tags` - List tags

#### Invoice Operations

- `freee_get_invoices` - List invoices
- `freee_create_invoice` - Create new invoice

#### Reports

- `freee_get_trial_balance` - Get trial balance report
- `freee_get_profit_loss` - Get profit and loss statement - **Optimal for operating profit!**
- `freee_get_balance_sheet` - Get balance sheet

### Efficient Operating Profit Retrieval

Instead of retrieving large amounts of individual transactions, use the **Profit & Loss API (`freee_get_profit_loss`)** to get financial data including operating profit with a single API call.

```
# Example: Get operating profit for fiscal year 2024
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2024
- startMonth: 4    # Start of fiscal year
- endMonth: 3      # End of fiscal year
```

This API returns pre-aggregated information including:

- Revenue
- Cost of goods sold
- Gross profit
- Selling, general & administrative expenses
- **Operating profit** ← Here!
- Non-operating income/expenses
- Ordinary profit
- Extraordinary gains/losses
- Net income

### Usage Examples

#### Check Monthly Operating Profit Trends

```
# Operating profit from April to June 2024
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2024
- startMonth: 4
- endMonth: 6
```

#### Get Operating Profit for Year-over-Year Comparison

```
# Current period (FY2024)
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2024
- startMonth: 4
- endMonth: 9

# Previous period (FY2023)
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2023
- startMonth: 4
- endMonth: 9
```

#### Partner-wise Operating Profit Analysis

```
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2024
- startMonth: 4
- endMonth: 12
- breakdownDisplayType: "partner"  # Breakdown by partner
```

### Performance Comparison

Aggregating operating profit from individual deals can require thousands of API calls and significant client-side processing. The `freee_get_profit_loss` tool returns pre-aggregated report data in a single request, which dramatically reduces rate-limit usage. For most reporting flows, start with report APIs and only fetch raw deals when you need detailed drill-down.

Tip: Set `FREEE_DEFAULT_COMPANY_ID` so report calls work without passing `companyId` each time.

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run typecheck
```

## Token Management

The server automatically manages OAuth tokens:

- Tokens are stored in the file specified by `TOKEN_STORAGE_PATH`
- Tokens are automatically refreshed when they expire
- Each company can have its own token

## Error Handling

The server provides detailed error messages for:

- Authentication failures
- API rate limits
- Invalid parameters
- Network errors

## Security

### Token Security

- **Encryption at Rest**: All tokens are encrypted using AES-256-GCM before storage
- **File Permissions**: Token files are created with 0600 permissions (owner read/write only)
- **Secure Storage Paths**: Platform-specific secure directories are used by default
- **Automatic Refresh**: Tokens are refreshed 5 minutes before expiry to prevent race conditions
- **Single-Use Refresh Tokens**: freee refresh tokens are handled correctly with proper error recovery

### General Security Guidelines

- Never commit your `.env` file or token files
- Never commit client config files that embed secrets (for example `.vscode/mcp.json`, `~/.cursor/mcp.json`, or Claude Desktop config files)
- Keep your Client Secret secure
- Use absolute paths for token storage outside the project directory
- Store tokens in platform-specific secure locations (e.g., `~/.config/freee-mcp/`)
- Use `FREEE_TOKEN_ENCRYPTION_KEY` for custom encryption keys

### Token Storage Options

#### File-Based Storage (Default)

```bash
# Default locations:
# macOS: ~/Library/Application Support/freee-mcp/tokens.enc
# Windows: %APPDATA%/freee-mcp/tokens.enc
# Linux: ~/.config/freee-mcp/tokens.enc

# Custom location via environment:
export TOKEN_STORAGE_PATH=/custom/path/tokens.enc
```

- Persistent across sessions
- Encrypted with configurable key
- Automatic permission management
- Requires file system access

#### Environment Variable Storage

```bash
# Base64 encoded token data (recommended for restricted environments)
export FREEE_TOKEN_DATA_BASE64="base64-encoded-json"

# Individual token variables (legacy)
export FREEE_ACCESS_TOKEN="your-access-token"
export FREEE_REFRESH_TOKEN="your-refresh-token"
# FREEE_COMPANY_ID is required to associate the token with a specific company
export FREEE_COMPANY_ID="12345"
```

- Works in serverless and restricted environments (e.g., Claude Desktop)
- No file system dependencies
- Easy to manage in CI/CD

### Secret Detection with Gitleaks

This project uses [Gitleaks](https://gitleaks.io/) to prevent accidental exposure of sensitive data:

- **Pre-commit Hook**: Automatically scans for secrets before each commit
- **CI/CD Integration**: GitHub Actions runs security scans on all PRs
- **Custom Rules**: Detects freee-specific credentials (Client ID, Secret, tokens)
- **Manual Scanning**: Run `npm run gitleaks` to check for secrets locally

**Available Commands:**

```bash
npm run gitleaks        # Scan for secrets (non-blocking)
npm run gitleaks:ci     # Scan for secrets (CI mode, blocks on findings)
```

## Troubleshooting

### Authentication Issues

- **Authentication errors**: Ensure your Client ID and Secret are correct. Re-run `npm run setup-auth` if needed
- **"Token refresh failed: invalid_grant"**: freee refresh tokens are single-use. Re-authenticate by running `npm run setup-auth`
- **"No authenticated companies found"**: Run `freee_get_auth_url` to start OAuth flow, then complete authorization in browser
- **"Permission denied" on token file**: Server automatically fixes permissions. Ensure parent directory is writable
- **"Cannot find tokens.enc"**: Use absolute paths in configuration, or try environment variable storage for restricted environments

### General Issues

- **Token expiration**: The server automatically refreshes tokens 5 minutes before expiry
- **Rate limits**: freee API has rate limits (3,600 requests/hour). Use aggregated report APIs to minimize calls
- **Company ID required**: Most operations require a company ID. Set `FREEE_DEFAULT_COMPANY_ID` to avoid specifying it each time

## License

MIT

## Support

For issues related to:

- This MCP server: Create an issue in this repository
- freee API: Consult [freee Developers Community](https://developer.freee.co.jp/)
- MCP protocol: See [MCP documentation](https://modelcontextprotocol.io/)
