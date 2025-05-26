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

#### Claude Desktop Configuration

1. **Ensure the server is built** (see Installation step 3 above)

2. **Locate the configuration file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

3. **Choose your configuration method:**

   **Option A: Using tokens.json (Recommended after running setup-auth)**
   ```json
   {
     "mcpServers": {
       "freee": {
         "command": "node",
         "args": ["/absolute/path/to/freee-mcp/dist/index.js"],
         "env": {
           "FREEE_CLIENT_ID": "your_client_id_here",
           "FREEE_CLIENT_SECRET": "your_client_secret_here",
           "TOKEN_STORAGE_PATH": "/absolute/path/to/freee-mcp/tokens.json",
           "FREEE_DEFAULT_COMPANY_ID": "3260106"  // Optional: Set default company ID
         }
       }
     }
   }
   ```

   **Option B: Using environment variables for tokens**
   ```json
   {
     "mcpServers": {
       "freee": {
         "command": "node",
         "args": ["/absolute/path/to/freee-mcp/dist/index.js"],
         "env": {
           "FREEE_CLIENT_ID": "your_client_id_here",
           "FREEE_CLIENT_SECRET": "your_client_secret_here",
           "FREEE_ACCESS_TOKEN": "your_access_token",
           "FREEE_REFRESH_TOKEN": "your_refresh_token",
           "FREEE_COMPANY_ID": "your_company_id"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop** to apply the configuration.

5. **Verify the server is running** by checking if freee tools are available in Claude. Try asking "What freee tools are available?"

#### Other MCP Clients

For other MCP clients, adapt the configuration format as needed:

## Usage

### Authentication Methods

#### Method 1: Using Setup Script (Recommended)

Run the interactive setup script:
```bash
npm run setup-auth
```

This script will:
1. Load credentials from `.env` file if available
2. Check for existing tokens in `tokens.json`
3. Open the authorization URL in your browser
4. Wait for you to authorize and get the code
5. Exchange the code for tokens immediately
6. Save tokens to `tokens.json` or display environment variables

After running this script, use **Option A** in the Claude Desktop configuration above.

#### Method 2: Environment Variables

If you already have tokens, you can directly set them in the Claude Desktop configuration. Use **Option B** in the Claude Desktop configuration above with your actual token values.

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

freee MCP supports multiple companies (事業所). When you authenticate, the server automatically obtains access to all companies associated with your freee account.

#### Setting a Default Company

To avoid specifying `companyId` for every API call, you can set a default company ID:

```json
{
  "env": {
    "FREEE_DEFAULT_COMPANY_ID": "3260106"  // Your default company ID
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
Use tool: freee_get_deals with companyId: 3260106
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
- `freee_get_trial_balance` - Get trial balance report (試算表)
- `freee_get_profit_loss` - Get profit and loss statement (損益計算書) - **営業利益に最適！**
- `freee_get_balance_sheet` - Get balance sheet (貸借対照表)  
- `freee_get_cash_flow` - Get cash flow statement (キャッシュフロー計算書)

### 効率的な営業利益の取得方法

個別取引を大量に取得する代わりに、**損益計算書API (`freee_get_profit_loss`)** を使用することで、1回のAPI呼び出しで営業利益を含む財務データを取得できます。

```
# 例：2024年度の営業利益を取得
Use tool: freee_get_profit_loss
Parameters:
- fiscalYear: 2024
- startMonth: 4    # 期首月
- endMonth: 3      # 期末月
```

このAPIは以下の情報を集計済みで返します：
- 売上高
- 売上原価  
- 売上総利益
- 販売費及び一般管理費
- **営業利益** ← ここ！
- 営業外収益・費用
- 経常利益
- 特別損益
- 当期純利益

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