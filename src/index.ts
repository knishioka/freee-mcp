#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  McpError,
  ErrorCode,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import type { z } from 'zod';
import { FreeeClient } from './api/freeeClient.js';
import { TokenManager } from './auth/tokenManager.js';
import { SERVER_NAME } from './constants.js';
import * as schemas from './schemas.js';

const packageJson = (() => {
  try {
    const content = readFileSync(
      new URL('../package.json', import.meta.url),
      'utf-8',
    );
    const parsed = JSON.parse(content);
    return { version: String(parsed.version ?? 'unknown') };
  } catch (error) {
    console.error(
      'Warning: Could not read version from package.json. Using fallback.',
      error,
    );
    return { version: 'unknown' };
  }
})();

// Load environment variables
dotenv.config();

const clientId = process.env.FREEE_CLIENT_ID;
const clientSecret = process.env.FREEE_CLIENT_SECRET;
const redirectUri =
  process.env.FREEE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
const tokenStoragePath =
  process.env.TOKEN_STORAGE_PATH || TokenManager.getDefaultStoragePath();
const defaultCompanyId = process.env.FREEE_DEFAULT_COMPANY_ID
  ? parseInt(process.env.FREEE_DEFAULT_COMPANY_ID)
  : undefined;

// Support for base64 encoded tokens in environment
const envTokenData = process.env.FREEE_TOKEN_DATA_BASE64;

if (!clientId || !clientSecret) {
  console.error('\n=== freee MCP Configuration Error ===');
  console.error('Required environment variables are missing.');
  console.error('\nPlease set the following environment variables:');
  console.error('  - FREEE_CLIENT_ID: Your freee OAuth app client ID');
  console.error('  - FREEE_CLIENT_SECRET: Your freee OAuth app client secret');
  console.error('\nOptional configuration:');
  console.error('  - FREEE_DEFAULT_COMPANY_ID: Default company ID to use');
  console.error('  - TOKEN_STORAGE_PATH: Custom path for token storage');
  console.error(
    '  - FREEE_TOKEN_ENCRYPTION_KEY: Custom encryption key for tokens',
  );
  console.error(
    '  - FREEE_TOKEN_DATA_BASE64: Base64 encoded token data for serverless environments',
  );
  console.error(
    '\nFor Claude Desktop, add these to your MCP settings configuration.',
  );
  console.error('See MCP_AUTHENTICATION.md for detailed setup instructions.');
  console.error('=====================================\n');
  throw new Error(
    'FREEE_CLIENT_ID and FREEE_CLIENT_SECRET must be set in environment variables',
  );
}

// Initialize components
const tokenManager = new TokenManager(tokenStoragePath);
const freeeClient = new FreeeClient(
  clientId,
  clientSecret,
  redirectUri,
  tokenManager,
);

// Create MCP server
const server = new McpServer(
  {
    name: SERVER_NAME,
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Helper function to get company ID with default fallback
function getCompanyId(providedId?: number): number {
  const companyId = providedId || defaultCompanyId;
  if (!companyId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Company ID is required. Either set FREEE_DEFAULT_COMPANY_ID environment variable or provide companyId parameter.',
    );
  }
  return companyId;
}

// Helper function to format errors
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Workaround for TS2589: cumulative registerTool calls with complex Zod schemas
// exceed TypeScript's type instantiation depth limit due to Zod v3/v4 dual type inference.
// This non-generic wrapper breaks the inference chain while preserving runtime validation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registerTool(
  name: string,
  config: { description: string; inputSchema?: Record<string, z.ZodTypeAny> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<CallToolResult>,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool(name, config, handler);
}

// Helper to handle tool errors with logging
function handleToolError(toolName: string, error: unknown): never {
  console.error(`Tool execution error in ${toolName}:`, error);

  if (error instanceof McpError) {
    throw error;
  }

  throw new McpError(
    ErrorCode.InternalError,
    `Tool execution failed: ${formatError(error)}`,
  );
}

// === Auth tools ===

registerTool(
  'freee_get_auth_url',
  {
    description: 'Get the authorization URL for freee OAuth flow',
    inputSchema: schemas.AuthorizeSchema,
  },
  async ({ state }) => {
    try {
      const authUrl = freeeClient.getAuthorizationUrl(state);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Authorization URL: ${authUrl}\n\nPlease visit this URL to authorize the application.`,
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_auth_url', error);
    }
  },
);

registerTool(
  'freee_get_access_token',
  {
    description: 'Exchange authorization code for access token',
    inputSchema: schemas.GetTokenSchema,
  },
  async ({ code }) => {
    try {
      const tokenResponse = await freeeClient.getAccessToken(code);

      // Temporarily store token to fetch company list
      await tokenManager.setToken(0, tokenResponse);
      let companies;
      try {
        companies = await freeeClient.getCompanies();
        for (const company of companies) {
          await tokenManager.setToken(company.id, tokenResponse);
        }
      } finally {
        await tokenManager.removeToken(0);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Access token obtained successfully. Token stored for ${companies.length} companies: ${companies.map((c) => c.display_name).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_access_token', error);
    }
  },
);

registerTool(
  'freee_set_company_token',
  {
    description: 'Manually set access token for a specific company',
    inputSchema: schemas.SetCompanyTokenSchema,
  },
  async ({ companyId, accessToken, refreshToken, expiresIn }) => {
    try {
      await tokenManager.setToken(companyId, {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        token_type: 'Bearer',
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Token set successfully for company ${companyId}`,
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_set_company_token', error);
    }
  },
);

// === Company tools ===

registerTool(
  'freee_get_companies',
  {
    description:
      'Get list of accessible companies - Retrieves all companies linked to your freee account in one call. Essential first step to get company IDs for subsequent API calls. Cache results as company list rarely changes.',
  },
  async () => {
    try {
      const companies = await freeeClient.getCompanies();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(companies, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_companies', error);
    }
  },
);

registerTool(
  'freee_get_company',
  {
    description:
      'Get specific company details - Retrieves company master data including fiscal year settings. Use this to understand accounting periods for report APIs. One-time call per session is usually sufficient.',
    inputSchema: schemas.GetCompanySchema,
  },
  async ({ companyId }) => {
    try {
      const company = await freeeClient.getCompany(getCompanyId(companyId));
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(company, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_company', error);
    }
  },
);

// === Deal tools ===

registerTool(
  'freee_get_deals',
  {
    description:
      'Get list of deals (transactions) - Use with date filters and pagination for efficiency. For financial analysis, prefer aggregated report APIs (profit_loss, balance_sheet) which process thousands of transactions server-side. Only use for detailed transaction inspection.',
    inputSchema: schemas.GetDealsSchema,
  },
  async ({
    companyId,
    partnerId,
    accountItemId,
    startIssueDate,
    endIssueDate,
    offset,
    limit,
  }) => {
    try {
      const deals = await freeeClient.getDeals(getCompanyId(companyId), {
        partner_id: partnerId,
        account_item_id: accountItemId,
        start_issue_date: startIssueDate,
        end_issue_date: endIssueDate,
        offset,
        limit,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(deals, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_deals', error);
    }
  },
);

registerTool(
  'freee_get_deal',
  {
    description: 'Get specific deal details',
    inputSchema: schemas.GetDealSchema,
  },
  async ({ companyId, dealId }) => {
    try {
      const deal = await freeeClient.getDeal(getCompanyId(companyId), dealId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(deal, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_deal', error);
    }
  },
);

registerTool(
  'freee_create_deal',
  {
    description: 'Create a new deal (transaction)',
    inputSchema: schemas.CreateDealSchema,
  },
  async ({
    companyId,
    issueDate,
    type,
    partnerId,
    dueDate,
    refNumber,
    details,
  }) => {
    try {
      const deal = await freeeClient.createDeal(getCompanyId(companyId), {
        issue_date: issueDate,
        type,
        partner_id: partnerId,
        due_date: dueDate,
        ref_number: refNumber,
        amount: details.reduce(
          (sum: number, d: { amount: number }) => sum + d.amount,
          0,
        ),
        status: 'unsettled',
        details: details.map(
          (d: {
            accountItemId: number;
            taxCode: number;
            amount: number;
            description?: string;
            sectionId?: number;
            tagIds?: number[];
          }) => ({
            account_item_id: d.accountItemId,
            tax_code: d.taxCode,
            amount: d.amount,
            description: d.description,
            section_id: d.sectionId,
            tag_ids: d.tagIds,
          }),
        ),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(deal, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_deal', error);
    }
  },
);

// === Account Item tools ===

registerTool(
  'freee_get_account_items',
  {
    description:
      'Get list of account items - Retrieves chart of accounts efficiently in one call. Use this master data for mapping and filtering in reports. Cached results recommended as account structure rarely changes.',
    inputSchema: schemas.GetAccountItemsSchema,
  },
  async ({ companyId, accountCategory }) => {
    try {
      const items = await freeeClient.getAccountItems(
        getCompanyId(companyId),
        accountCategory,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_account_items', error);
    }
  },
);

// === Partner tools ===

registerTool(
  'freee_get_partners',
  {
    description:
      'Get list of partners - Retrieves customer/vendor master data efficiently. For partner-based analysis, use profit_loss API with partner breakdown instead of aggregating individual transactions. Cache results as partner data changes infrequently.',
    inputSchema: schemas.GetPartnersSchema,
  },
  async ({ companyId, name, shortcut1, offset, limit }) => {
    try {
      const partners = await freeeClient.getPartners(getCompanyId(companyId), {
        name,
        shortcut1,
        offset,
        limit,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(partners, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_partners', error);
    }
  },
);

registerTool(
  'freee_create_partner',
  {
    description: 'Create a new partner',
    inputSchema: schemas.CreatePartnerSchema,
  },
  async ({
    companyId,
    name,
    shortcut1,
    shortcut2,
    longName,
    nameKana,
    countryCode,
  }) => {
    try {
      const partner = await freeeClient.createPartner(getCompanyId(companyId), {
        name,
        shortcut1,
        shortcut2,
        long_name: longName,
        name_kana: nameKana,
        country_code: countryCode,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(partner, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_partner', error);
    }
  },
);

// === Section tools ===

registerTool(
  'freee_get_sections',
  {
    description:
      'Get list of sections (departments/divisions) - Retrieves organizational units for segment reporting. Use with profit_loss breakdown_display_type="section" for departmental P&L analysis in one API call.',
    inputSchema: schemas.GetSectionsSchema,
  },
  async ({ companyId }) => {
    try {
      const sections = await freeeClient.getSections(getCompanyId(companyId));
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(sections, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_sections', error);
    }
  },
);

// === Tag tools ===

registerTool(
  'freee_get_tags',
  {
    description:
      'Get list of tags - Retrieves custom classification tags. For tag-based analysis, use profit_loss API with tag breakdown for efficient aggregation. Useful for project/campaign tracking.',
    inputSchema: schemas.GetTagsSchema,
  },
  async ({ companyId }) => {
    try {
      const tags = await freeeClient.getTags(getCompanyId(companyId));
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_tags', error);
    }
  },
);

// === Invoice tools ===

registerTool(
  'freee_get_invoices',
  {
    description:
      'Get list of invoices - Retrieves invoice data with filtering options. For revenue analysis, prefer profit_loss API with partner breakdown. Use this for specific invoice management and AR tracking.',
    inputSchema: schemas.GetInvoicesSchema,
  },
  async ({
    companyId,
    partnerId,
    invoiceStatus,
    paymentStatus,
    startIssueDate,
    endIssueDate,
    offset,
    limit,
  }) => {
    try {
      const invoices = await freeeClient.getInvoices(getCompanyId(companyId), {
        partner_id: partnerId,
        invoice_status: invoiceStatus,
        payment_status: paymentStatus,
        start_issue_date: startIssueDate,
        end_issue_date: endIssueDate,
        offset,
        limit,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(invoices, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_invoices', error);
    }
  },
);

registerTool(
  'freee_create_invoice',
  {
    description: 'Create a new invoice',
    inputSchema: schemas.CreateInvoiceSchema,
  },
  async ({
    companyId,
    issueDate,
    partnerId,
    dueDate,
    title,
    invoiceStatus,
    invoiceLines,
  }) => {
    try {
      const invoice = await freeeClient.createInvoice(getCompanyId(companyId), {
        issue_date: issueDate,
        partner_id: partnerId,
        due_date: dueDate,
        title,
        invoice_status: invoiceStatus,
        total_amount: invoiceLines.reduce(
          (sum: number, line: { quantity: number; unitPrice: number }) =>
            sum + line.quantity * line.unitPrice,
          0,
        ),
        invoice_lines: invoiceLines.map(
          (line: {
            name: string;
            quantity: number;
            unitPrice: number;
            description?: string;
            taxCode?: number;
            accountItemId?: number;
          }) => ({
            name: line.name,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            amount: line.quantity * line.unitPrice,
            description: line.description,
            tax_code: line.taxCode,
            account_item_id: line.accountItemId,
          }),
        ),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(invoice, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_invoice', error);
    }
  },
);

// === Report tools ===

registerTool(
  'freee_get_trial_balance',
  {
    description:
      'Get trial balance report - Efficiently retrieves aggregated account balances for all accounts in one API call. Use for financial analysis, balance verification, and period comparisons without processing individual transactions. Supports monthly/quarterly/annual periods.',
    inputSchema: schemas.GetTrialBalanceSchema,
  },
  async ({ companyId, fiscalYear, startMonth, endMonth }) => {
    try {
      const trialBalance = await freeeClient.getTrialBalance(
        getCompanyId(companyId),
        {
          fiscal_year: fiscalYear,
          start_month: startMonth,
          end_month: endMonth,
        },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(trialBalance, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_trial_balance', error);
    }
  },
);

registerTool(
  'freee_get_profit_loss',
  {
    description:
      'Get profit and loss statement - Most efficient for profitability analysis. Returns revenue, COGS, operating profit, and net income in one API call. Use breakdown_display_type for segment analysis (partner/section/item/tag). Ideal for monthly trends, YoY comparisons, and KPI dashboards instead of aggregating thousands of transactions.',
    inputSchema: schemas.GetProfitLossSchema,
  },
  async ({
    companyId,
    fiscalYear,
    startMonth,
    endMonth,
    breakdownDisplayType,
  }) => {
    try {
      const profitLoss = await freeeClient.getProfitLoss(
        getCompanyId(companyId),
        {
          fiscal_year: fiscalYear,
          start_month: startMonth,
          end_month: endMonth,
          breakdown_display_type: breakdownDisplayType,
        },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(profitLoss, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_profit_loss', error);
    }
  },
);

registerTool(
  'freee_get_balance_sheet',
  {
    description:
      'Get balance sheet - Efficiently retrieves financial position with assets, liabilities, and equity pre-aggregated. Use for liquidity ratios, solvency analysis, and working capital calculations. Single API call replaces complex transaction aggregation.',
    inputSchema: schemas.GetBalanceSheetSchema,
  },
  async ({
    companyId,
    fiscalYear,
    startMonth,
    endMonth,
    breakdownDisplayType,
  }) => {
    try {
      const balanceSheet = await freeeClient.getBalanceSheet(
        getCompanyId(companyId),
        {
          fiscal_year: fiscalYear,
          start_month: startMonth,
          end_month: endMonth,
          breakdown_display_type: breakdownDisplayType,
        },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(balanceSheet, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_balance_sheet', error);
    }
  },
);

// === Resource handlers ===

server.registerResource(
  'company',
  new ResourceTemplate('freee://company/{companyId}', {
    list: async () => ({
      resources: tokenManager.getAllCompanyIds().map((id) => ({
        uri: `freee://company/${id}`,
        name: `Company ${id}`,
        description: `freee company with ID ${id}`,
        mimeType: 'application/json' as const,
      })),
    }),
  }),
  {
    description: 'freee company data',
    mimeType: 'application/json',
  },
  async (uri, { companyId }) => {
    try {
      const id = parseInt(String(companyId), 10);
      const token = tokenManager.getToken(id);

      if (!token) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'No token found for this company',
        );
      }

      const company = await freeeClient.getCompany(id);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(company, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Resource read error for company:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Resource read failed: ${formatError(error)}`,
      );
    }
  },
);

// Initialize and start server
async function main() {
  // Load saved tokens
  await tokenManager.loadTokens();

  // Check for base64 encoded token data first (for serverless/restricted environments)
  if (envTokenData) {
    try {
      const tokenJson = Buffer.from(envTokenData, 'base64').toString('utf-8');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenArray: Array<[number, any]> = JSON.parse(tokenJson);

      for (const [companyId, tokenData] of tokenArray) {
        await tokenManager.setToken(companyId, tokenData);
      }

      console.error(
        'Loaded tokens from FREEE_TOKEN_DATA_BASE64 environment variable',
      );
    } catch (error) {
      console.error('Failed to parse FREEE_TOKEN_DATA_BASE64:', error);
    }
  }

  // Check for individual token environment variables (legacy support)
  const envAccessToken = process.env.FREEE_ACCESS_TOKEN;
  const envRefreshToken = process.env.FREEE_REFRESH_TOKEN;
  const envCompanyId = process.env.FREEE_COMPANY_ID;
  const envTokenExpiry = process.env.FREEE_TOKEN_EXPIRES_AT;

  if (envAccessToken && envRefreshToken && envCompanyId) {
    console.error('Setting tokens from individual environment variables...');
    const createdAt = envTokenExpiry
      ? parseInt(envTokenExpiry) - 86400 // Assume 24h expiry if expires_at is provided
      : Math.floor(Date.now() / 1000);

    await tokenManager.setToken(parseInt(envCompanyId), {
      access_token: envAccessToken,
      refresh_token: envRefreshToken,
      expires_in: 86400, // 24 hours
      token_type: 'Bearer',
      scope: 'read write',
      created_at: createdAt,
    });
  }

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  if (!process.env.FREEE_TOKEN_ENCRYPTION_KEY) {
    console.error(
      'Warning: FREEE_TOKEN_ENCRYPTION_KEY is not set. Using default encryption key for token storage. Set this environment variable for stronger security.',
    );
  }

  console.error('freee MCP server started');
  console.error(`Token storage: ${tokenStoragePath}`);

  const companyIds = tokenManager.getAllCompanyIds();
  if (companyIds.length > 0) {
    console.error(`Authenticated companies: ${companyIds.join(', ')}`);
  } else {
    console.error(
      'No authenticated companies. Use freee_get_auth_url to start OAuth flow.',
    );
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
