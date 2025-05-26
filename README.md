# MCP Server for freee Accounting API

A Model Context Protocol (MCP) server that provides integration with freee accounting software API, enabling AI assistants to interact with accounting data.

## Features

- OAuth 2.0 authentication flow support
- Company management
- Transaction (Deal) operations
- Account items (勘定科目) management
- Partner (取引先) management
- Sections (部門) and Tags (メモタグ)
- Invoice creation and management
- Trial balance reports
- Token persistence and automatic refresh

## Prerequisites

- Node.js 18 or higher
- freee API credentials (Client ID and Client Secret)
- freee account with API access

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd mcp-server-freee
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file and configure it:
```bash
cp .env.example .env
```

4. Edit `.env` with your freee API credentials:
```
FREEE_CLIENT_ID=your_client_id_here
FREEE_CLIENT_SECRET=your_client_secret_here
FREEE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
TOKEN_STORAGE_PATH=./tokens.json
```

## Configuration

### Getting freee API Credentials

1. Log in to your freee account
2. Go to the [freee App Store](https://app.secure.freee.co.jp/developers/apps)
3. Create a new application
4. Note down the Client ID and Client Secret
5. Set the redirect URI (use `urn:ietf:wg:oauth:2.0:oob` for local development)

### MCP Client Configuration

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "freee": {
      "command": "node",
      "args": ["path/to/mcp-server-freee/dist/index.js"],
      "env": {
        "FREEE_CLIENT_ID": "your_client_id",
        "FREEE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## Usage

### Authentication Flow

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
- `freee_get_account_items` - List account items (勘定科目)
- `freee_get_partners` - List partners (取引先)
- `freee_create_partner` - Create new partner
- `freee_get_sections` - List sections (部門)
- `freee_get_tags` - List tags (メモタグ)

#### Invoice Operations
- `freee_get_invoices` - List invoices
- `freee_create_invoice` - Create new invoice

#### Reports
- `freee_get_trial_balance` - Get trial balance report

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

## Security Notes

- Never commit your `.env` file or tokens.json
- Keep your Client Secret secure
- Use environment variables for sensitive data
- Tokens are automatically refreshed to maintain security

## Troubleshooting

1. **Authentication errors**: Ensure your Client ID and Secret are correct
2. **Token expiration**: The server automatically refreshes tokens
3. **Rate limits**: freee API has rate limits (3,600 requests/hour)
4. **Company ID required**: Most operations require a company ID

## License

MIT

## Support

For issues related to:
- This MCP server: Create an issue in this repository
- freee API: Consult [freee Developers Community](https://developer.freee.co.jp/)
- MCP protocol: See [MCP documentation](https://modelcontextprotocol.io/)