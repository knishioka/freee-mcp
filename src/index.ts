#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { FreeeClient } from './api/freeeClient.js';
import { TokenManager } from './auth/tokenManager.js';
import * as schemas from './schemas.js';
import * as jsonSchemas from './jsonSchemas.js';

// Load environment variables
dotenv.config();

const clientId = process.env.FREEE_CLIENT_ID;
const clientSecret = process.env.FREEE_CLIENT_SECRET;
const redirectUri = process.env.FREEE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
const tokenStoragePath = process.env.TOKEN_STORAGE_PATH || TokenManager.getDefaultStoragePath();
const defaultCompanyId = process.env.FREEE_DEFAULT_COMPANY_ID ? parseInt(process.env.FREEE_DEFAULT_COMPANY_ID) : undefined;

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
  console.error('  - FREEE_TOKEN_ENCRYPTION_KEY: Custom encryption key for tokens');
  console.error('  - FREEE_TOKEN_DATA_BASE64: Base64 encoded token data for serverless environments');
  console.error('\nFor Claude Desktop, add these to your MCP settings configuration.');
  console.error('See MCP_AUTHENTICATION.md for detailed setup instructions.');
  console.error('=====================================\n');
  throw new Error('FREEE_CLIENT_ID and FREEE_CLIENT_SECRET must be set in environment variables');
}

// Initialize components
const tokenManager = new TokenManager(tokenStoragePath);
const freeeClient = new FreeeClient(clientId, clientSecret, redirectUri, tokenManager);

// Create MCP server
const server = new Server(
  {
    name: 'freee-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper function to get company ID with default fallback
function getCompanyId(providedId?: number): number {
  const companyId = providedId || defaultCompanyId;
  if (!companyId) {
    throw new McpError(
      ErrorCode.InvalidParams, 
      'Company ID is required. Either set FREEE_DEFAULT_COMPANY_ID environment variable or provide companyId parameter.'
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

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Auth tools
      {
        name: 'freee_get_auth_url',
        description: 'Get the authorization URL for freee OAuth flow',
        inputSchema: jsonSchemas.AuthorizeSchema,
      },
      {
        name: 'freee_get_access_token',
        description: 'Exchange authorization code for access token',
        inputSchema: jsonSchemas.GetTokenSchema,
      },
      {
        name: 'freee_set_company_token',
        description: 'Manually set access token for a specific company',
        inputSchema: jsonSchemas.SetCompanyTokenSchema,
      },
      // Company tools
      {
        name: 'freee_get_companies',
        description: 'Get list of accessible companies - Retrieves all companies linked to your freee account in one call. Essential first step to get company IDs for subsequent API calls. Cache results as company list rarely changes.',
        inputSchema: jsonSchemas.GetCompaniesSchema,
      },
      {
        name: 'freee_get_company',
        description: 'Get specific company details - Retrieves company master data including fiscal year settings. Use this to understand accounting periods for report APIs. One-time call per session is usually sufficient.',
        inputSchema: jsonSchemas.GetCompanySchema,
      },
      // Deal tools
      {
        name: 'freee_get_deals',
        description: 'Get list of deals (transactions) - Use with date filters and pagination for efficiency. For financial analysis, prefer aggregated report APIs (profit_loss, balance_sheet) which process thousands of transactions server-side. Only use for detailed transaction inspection.',
        inputSchema: jsonSchemas.GetDealsSchema,
      },
      {
        name: 'freee_get_deal',
        description: 'Get specific deal details',
        inputSchema: jsonSchemas.GetDealSchema,
      },
      {
        name: 'freee_create_deal',
        description: 'Create a new deal (transaction)',
        inputSchema: jsonSchemas.CreateDealSchema,
      },
      // Account Item tools
      {
        name: 'freee_get_account_items',
        description: 'Get list of account items - Retrieves chart of accounts efficiently in one call. Use this master data for mapping and filtering in reports. Cached results recommended as account structure rarely changes.',
        inputSchema: jsonSchemas.GetAccountItemsSchema,
      },
      // Partner tools
      {
        name: 'freee_get_partners',
        description: 'Get list of partners - Retrieves customer/vendor master data efficiently. For partner-based analysis, use profit_loss API with partner breakdown instead of aggregating individual transactions. Cache results as partner data changes infrequently.',
        inputSchema: jsonSchemas.GetPartnersSchema,
      },
      {
        name: 'freee_create_partner',
        description: 'Create a new partner',
        inputSchema: jsonSchemas.CreatePartnerSchema,
      },
      // Section tools
      {
        name: 'freee_get_sections',
        description: 'Get list of sections (departments/divisions) - Retrieves organizational units for segment reporting. Use with profit_loss breakdown_display_type="section" for departmental P&L analysis in one API call.',
        inputSchema: jsonSchemas.GetSectionsSchema,
      },
      // Tag tools
      {
        name: 'freee_get_tags',
        description: 'Get list of tags - Retrieves custom classification tags. For tag-based analysis, use profit_loss API with tag breakdown for efficient aggregation. Useful for project/campaign tracking.',
        inputSchema: jsonSchemas.GetTagsSchema,
      },
      // Invoice tools
      {
        name: 'freee_get_invoices',
        description: 'Get list of invoices - Retrieves invoice data with filtering options. For revenue analysis, prefer profit_loss API with partner breakdown. Use this for specific invoice management and AR tracking.',
        inputSchema: jsonSchemas.GetInvoicesSchema,
      },
      {
        name: 'freee_create_invoice',
        description: 'Create a new invoice',
        inputSchema: jsonSchemas.CreateInvoiceSchema,
      },
      // Report tools
      {
        name: 'freee_get_trial_balance',
        description: 'Get trial balance report - Efficiently retrieves aggregated account balances for all accounts in one API call. Use for financial analysis, balance verification, and period comparisons without processing individual transactions. Supports monthly/quarterly/annual periods.',
        inputSchema: jsonSchemas.GetTrialBalanceSchema,
      },
      {
        name: 'freee_get_profit_loss',
        description: 'Get profit and loss statement - Most efficient for profitability analysis. Returns revenue, COGS, operating profit, and net income in one API call. Use breakdown_display_type for segment analysis (partner/section/item/tag). Ideal for monthly trends, YoY comparisons, and KPI dashboards instead of aggregating thousands of transactions.',
        inputSchema: jsonSchemas.GetProfitLossSchema,
      },
      {
        name: 'freee_get_balance_sheet',
        description: 'Get balance sheet - Efficiently retrieves financial position with assets, liabilities, and equity pre-aggregated. Use for liquidity ratios, solvency analysis, and working capital calculations. Single API call replaces complex transaction aggregation.',
        inputSchema: jsonSchemas.GetBalanceSheetSchema,
      },
      {
        name: 'freee_get_cash_flow',
        description: 'Get cash flow statement - NOT AVAILABLE: freee API does not provide a cash flow endpoint. Calculate cash flow from P&L and balance sheet changes instead.',
        inputSchema: jsonSchemas.GetCashFlowSchema,
      },
    ],
  };
});

// Register resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const companyIds = tokenManager.getAllCompanyIds();
  
  return {
    resources: companyIds.map(id => ({
      uri: `freee://company/${id}`,
      name: `Company ${id}`,
      description: `freee company with ID ${id}`,
      mimeType: 'application/json',
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const match = request.params.uri.match(/^freee:\/\/company\/(\d+)$/);
  if (!match) {
    throw new McpError(ErrorCode.InvalidRequest, 'Invalid resource URI');
  }
  
  const companyId = parseInt(match[1], 10);
  const token = tokenManager.getToken(companyId);
  
  if (!token) {
    throw new McpError(ErrorCode.InvalidRequest, 'No token found for this company');
  }
  
  const company = await freeeClient.getCompany(companyId);
  
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'application/json',
        text: JSON.stringify(company, null, 2),
      },
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
    // Auth tools
    case 'freee_get_auth_url': {
      const params = schemas.AuthorizeSchema.parse(args);
      const authUrl = freeeClient.getAuthorizationUrl(params.state);
      return {
        content: [
          {
            type: 'text',
            text: `Authorization URL: ${authUrl}\n\nPlease visit this URL to authorize the application.`,
          },
        ],
      };
    }

    case 'freee_get_access_token': {
      const params = schemas.GetTokenSchema.parse(args);
      console.error('🔐 Starting token exchange for code:', `${params.code.substring(0, 10)  }...`);
      
      // Also log to file for Claude Desktop debugging
      const debugLog = `[${new Date().toISOString()}] Token exchange started for code: ${params.code.substring(0, 10)}...\n`;
      try {
        await fs.appendFile('/tmp/freee-mcp-debug.log', debugLog);
      } catch {
        // Ignore file write errors
      }
      
      const tokenResponse = await freeeClient.getAccessToken(params.code);
      console.error('✅ Token response received:', {
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
        createdAt: tokenResponse.created_at
      });
      
      // Log detailed token info to file
      const tokenLog = `[${new Date().toISOString()}] TOKEN DETAILS: expires_in=${tokenResponse.expires_in}, created_at=${tokenResponse.created_at}, token_type=${tokenResponse.token_type}\n`;
      try {
        await fs.appendFile('/tmp/freee-mcp-debug.log', tokenLog);
      } catch {
        // Ignore file write errors
      }
        
      // Temporarily store token with a dummy company ID to make the API call
      console.error('💾 Storing temporary token with company ID 0');
      await tokenManager.setToken(0, tokenResponse);
      
      // Verify temporary storage
      const tempToken = tokenManager.getToken(0);
      console.error('🔍 Temporary token verification:', {
        stored: !!tempToken,
        hasAccess: !!tempToken?.access_token,
        hasRefresh: !!tempToken?.refresh_token
      });
        
      // Get companies to store token properly
      console.error('🏢 Fetching companies list...');
      
      // Check token status before API call
      const preApiToken = tokenManager.getToken(0);
      if (preApiToken) {
        const preApiStatus = tokenManager.getTokenExpiryStatus(preApiToken);
        const timeToExpiry = preApiToken.expires_at - Math.floor(Date.now() / 1000);
        console.error('🔍 Pre-API token check:', {
          status: preApiStatus.status,
          remainingMinutes: preApiStatus.remainingMinutes,
          timeToExpiry
        });
        
        const preApiLog = `[${new Date().toISOString()}] PRE-API CHECK: status=${preApiStatus.status}, remaining=${preApiStatus.remainingMinutes}min, timeToExpiry=${timeToExpiry}s\n`;
        try {
          await fs.appendFile('/tmp/freee-mcp-debug.log', preApiLog);
        } catch {
        // Ignore file write errors
        }
      }
      
      const companies = await freeeClient.getCompanies();
      console.error('📋 Companies fetched:', companies.map(c => ({ id: c.id, name: c.display_name })));
        
      // Remove the temporary token
      console.error('🗑️ Removing temporary token');
      await tokenManager.removeToken(0);
        
      if (companies.length > 0) {
        // Store token for all companies
        console.error('💾 Storing tokens for all companies...');
        for (const company of companies) {
          await tokenManager.setToken(company.id, tokenResponse);
          console.error(`✅ Token stored for company ${company.id} (${company.display_name})`);
        }
        
        // Verify final storage
        const finalCompanyIds = tokenManager.getAllCompanyIds();
        console.error('🔍 Final verification - stored company IDs:', finalCompanyIds);
        
        for (const companyId of finalCompanyIds) {
          const storedToken = tokenManager.getToken(companyId);
          if (storedToken) {
            const expiryStatus = tokenManager.getTokenExpiryStatus(storedToken);
            console.error(`Company ${companyId} token status:`, {
              hasAccess: !!storedToken.access_token,
              hasRefresh: !!storedToken.refresh_token,
              status: expiryStatus.status,
              remainingMinutes: expiryStatus.remainingMinutes
            });
          }
        }
      }
        
      return {
        content: [
          {
            type: 'text',
            text: `Access token obtained successfully. Token stored for ${companies.length} companies: ${companies.map(c => c.display_name).join(', ')}`,
          },
        ],
      };
    }

    case 'freee_set_company_token': {
      const params = schemas.SetCompanyTokenSchema.parse(args);
      await tokenManager.setToken(params.companyId, {
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
        expires_in: params.expiresIn,
        token_type: 'Bearer',
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      });
        
      return {
        content: [
          {
            type: 'text',
            text: `Token set successfully for company ${params.companyId}`,
          },
        ],
      };
    }

    // Company tools
    case 'freee_get_companies': {
      const companies = await freeeClient.getCompanies();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(companies, null, 2),
          },
        ],
      };
    }

    case 'freee_get_company': {
      const params = schemas.GetCompanySchema.parse(args);
      const companyId = getCompanyId(params.companyId);
      const company = await freeeClient.getCompany(companyId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(company, null, 2),
          },
        ],
      };
    }

    // Deal tools
    case 'freee_get_deals': {
      const params = schemas.GetDealsSchema.parse(args);
      const companyId = getCompanyId(params.companyId);
      const deals = await freeeClient.getDeals(companyId, {
        partner_id: params.partnerId,
        account_item_id: params.accountItemId,
        start_issue_date: params.startIssueDate,
        end_issue_date: params.endIssueDate,
        offset: params.offset,
        limit: params.limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deals, null, 2),
          },
        ],
      };
    }

    case 'freee_get_deal': {
      const params = schemas.GetDealSchema.parse(args);
      const companyId = getCompanyId(params.companyId);
      const deal = await freeeClient.getDeal(companyId, params.dealId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deal, null, 2),
          },
        ],
      };
    }

    case 'freee_create_deal': {
      const params = schemas.CreateDealSchema.parse(args);
      const companyId = getCompanyId(params.companyId);
      const deal = await freeeClient.createDeal(companyId, {
        issue_date: params.issueDate,
        type: params.type,
        partner_id: params.partnerId,
        due_date: params.dueDate,
        ref_number: params.refNumber,
        amount: params.details.reduce((sum, d) => sum + d.amount, 0),
        status: 'unsettled',
        details: params.details.map(d => ({
          account_item_id: d.accountItemId,
          tax_code: d.taxCode,
          amount: d.amount,
          description: d.description,
          section_id: d.sectionId,
          tag_ids: d.tagIds,
        })),
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deal, null, 2),
          },
        ],
      };
    }

    // Account Item tools
    case 'freee_get_account_items': {
      const params = schemas.GetAccountItemsSchema.parse(args);
      const items = await freeeClient.getAccountItems(
        getCompanyId(params.companyId),
        params.accountCategory
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    }

    // Partner tools
    case 'freee_get_partners': {
      const params = schemas.GetPartnersSchema.parse(args);
      const partners = await freeeClient.getPartners(getCompanyId(params.companyId), {
        name: params.name,
        shortcut1: params.shortcut1,
        offset: params.offset,
        limit: params.limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(partners, null, 2),
          },
        ],
      };
    }

    case 'freee_create_partner': {
      const params = schemas.CreatePartnerSchema.parse(args);
      const partner = await freeeClient.createPartner(getCompanyId(params.companyId), {
        name: params.name,
        shortcut1: params.shortcut1,
        shortcut2: params.shortcut2,
        long_name: params.longName,
        name_kana: params.nameKana,
        country_code: params.countryCode,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(partner, null, 2),
          },
        ],
      };
    }

    // Section tools
    case 'freee_get_sections': {
      const params = schemas.GetSectionsSchema.parse(args);
      const sections = await freeeClient.getSections(getCompanyId(params.companyId));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sections, null, 2),
          },
        ],
      };
    }

    // Tag tools
    case 'freee_get_tags': {
      const params = schemas.GetTagsSchema.parse(args);
      const tags = await freeeClient.getTags(getCompanyId(params.companyId));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }

    // Invoice tools
    case 'freee_get_invoices': {
      const params = schemas.GetInvoicesSchema.parse(args);
      const invoices = await freeeClient.getInvoices(getCompanyId(params.companyId), {
        partner_id: params.partnerId,
        invoice_status: params.invoiceStatus,
        payment_status: params.paymentStatus,
        start_issue_date: params.startIssueDate,
        end_issue_date: params.endIssueDate,
        offset: params.offset,
        limit: params.limit,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(invoices, null, 2),
          },
        ],
      };
    }

    case 'freee_create_invoice': {
      const params = schemas.CreateInvoiceSchema.parse(args);
      const invoice = await freeeClient.createInvoice(getCompanyId(params.companyId), {
        issue_date: params.issueDate,
        partner_id: params.partnerId,
        due_date: params.dueDate,
        title: params.title,
        invoice_status: params.invoiceStatus,
        total_amount: params.invoiceLines.reduce(
          (sum, line) => sum + line.quantity * line.unitPrice,
          0
        ),
        invoice_lines: params.invoiceLines.map(line => ({
          name: line.name,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.quantity * line.unitPrice,
          description: line.description,
          tax_code: line.taxCode,
          account_item_id: line.accountItemId,
        })),
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(invoice, null, 2),
          },
        ],
      };
    }

    // Report tools
    case 'freee_get_trial_balance': {
      const params = schemas.GetTrialBalanceSchema.parse(args);
      const trialBalance = await freeeClient.getTrialBalance(getCompanyId(params.companyId), {
        fiscal_year: params.fiscalYear,
        start_month: params.startMonth,
        end_month: params.endMonth,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(trialBalance, null, 2),
          },
        ],
      };
    }

    case 'freee_get_profit_loss': {
      const params = schemas.GetProfitLossSchema.parse(args);
      const profitLoss = await freeeClient.getProfitLoss(getCompanyId(params.companyId), {
        fiscal_year: params.fiscalYear,
        start_month: params.startMonth,
        end_month: params.endMonth,
        breakdown_display_type: params.breakdownDisplayType,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(profitLoss, null, 2),
          },
        ],
      };
    }

    case 'freee_get_balance_sheet': {
      const params = schemas.GetBalanceSheetSchema.parse(args);
      const balanceSheet = await freeeClient.getBalanceSheet(getCompanyId(params.companyId), {
        fiscal_year: params.fiscalYear,
        start_month: params.startMonth,
        end_month: params.endMonth,
        breakdown_display_type: params.breakdownDisplayType,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(balanceSheet, null, 2),
          },
        ],
      };
    }

    case 'freee_get_cash_flow': {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Cash flow statement API is not available in freee API. Please use transaction data to calculate cash flow.'
      );
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    // Log error details to file for debugging
    const errorLog = `[${new Date().toISOString()}] ERROR in ${name}: ${formatError(error)}\n`;
    try {
      await fs.appendFile('/tmp/freee-mcp-debug.log', errorLog);
    } catch {
      // Ignore file logging errors - debug logging is optional
    }
    
    console.error(`Tool execution error in ${name}:`, error);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${formatError(error)}`
    );
  }
});

// Initialize and start server
async function main() {
  // Load saved tokens
  await tokenManager.loadTokens();
  
  // Check for base64 encoded token data first (for serverless/restricted environments)
  if (envTokenData) {
    try {
      const tokenJson = Buffer.from(envTokenData, 'base64').toString('utf-8');
      const tokenArray: Array<[number, any]> = JSON.parse(tokenJson);
      
      for (const [companyId, tokenData] of tokenArray) {
        await tokenManager.setToken(companyId, tokenData);
      }
      
      console.error('Loaded tokens from FREEE_TOKEN_DATA_BASE64 environment variable');
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
      ? parseInt(envTokenExpiry) - 86400  // Assume 24h expiry if expires_at is provided
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
  
  console.error('freee MCP server started');
  console.error(`Token storage: ${tokenStoragePath}`);
  
  const companyIds = tokenManager.getAllCompanyIds();
  if (companyIds.length > 0) {
    console.error(`Authenticated companies: ${companyIds.join(', ')}`);
  } else {
    console.error('No authenticated companies. Use freee_get_auth_url to start OAuth flow.');
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});