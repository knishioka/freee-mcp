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
import { ResponseFormatter } from './api/responseFormatter.js';
import type { FreeeDealUpdatePayload } from './types/freee.js';
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
  console.error(
    '  - FREEE_TOKEN_ENCRYPTION_KEY: Encryption key for token storage',
  );
  console.error('\nOptional configuration:');
  console.error('  - FREEE_DEFAULT_COMPANY_ID: Default company ID to use');
  console.error('  - TOKEN_STORAGE_PATH: Custom path for token storage');
  console.error(
    '  - FREEE_TOKEN_DATA_BASE64: Base64 encoded token data for serverless environments',
  );
  console.error(
    '\nFor Claude Desktop, add these to your MCP settings configuration.',
  );
  console.error('See README.md for detailed setup instructions.');
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
    compact,
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
      const formatted = ResponseFormatter.formatDeals(deals, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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
      const formatted = ResponseFormatter.formatDeal(deal);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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

registerTool(
  'freee_update_deal',
  {
    description:
      'Update an existing deal (transaction) - Modify issue date, type, or detail lines (amount, account item, tax code, description). Details array replaces all existing details. Use freee_get_deal first to review current state before updating.',
    inputSchema: schemas.UpdateDealSchema,
  },
  async ({ companyId, dealId, issueDate, type, details }) => {
    try {
      const updateData: FreeeDealUpdatePayload = {};
      if (issueDate !== undefined) updateData.issue_date = issueDate;
      if (type !== undefined) updateData.type = type;
      if (details !== undefined) {
        updateData.details = details.map(
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
        );
      }
      const deal = await freeeClient.updateDeal(
        getCompanyId(companyId),
        dealId,
        updateData,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(deal, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_update_deal', error);
    }
  },
);

registerTool(
  'freee_create_deal_payment',
  {
    description:
      'Record a payment for a deal (支払消込) - Add a payment entry to settle accounts receivable/payable. Supports partial payments (amount less than deal total). Use freee_get_walletables to look up wallet account IDs. Essential for monthly closing and cash management.',
    inputSchema: schemas.CreateDealPaymentSchema,
  },
  async ({
    companyId,
    dealId,
    date,
    fromWalletableId,
    fromWalletableType,
    amount,
  }) => {
    try {
      const payment = await freeeClient.createDealPayment(
        getCompanyId(companyId),
        dealId,
        {
          date,
          from_walletable_type: fromWalletableType,
          from_walletable_id: fromWalletableId,
          amount,
        },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payment, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_deal_payment', error);
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
  async ({ companyId, accountCategory, compact }) => {
    try {
      const items = await freeeClient.getAccountItems(
        getCompanyId(companyId),
        accountCategory,
      );
      const formatted = ResponseFormatter.formatAccountItems(items, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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
  async ({ companyId, name, shortcut1, offset, limit, compact }) => {
    try {
      const partners = await freeeClient.getPartners(getCompanyId(companyId), {
        name,
        shortcut1,
        offset,
        limit,
      });
      const formatted = ResponseFormatter.formatPartners(partners, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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
  async ({ companyId, compact }) => {
    try {
      const sections = await freeeClient.getSections(getCompanyId(companyId));
      const formatted = ResponseFormatter.formatSections(sections, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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
  async ({ companyId, compact }) => {
    try {
      const tags = await freeeClient.getTags(getCompanyId(companyId));
      const formatted = ResponseFormatter.formatTags(tags, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_tags', error);
    }
  },
);

// === Tax Code tools ===

registerTool(
  'freee_get_tax_codes',
  {
    description:
      'Get list of tax codes (税区分マスター) - Retrieves all available tax classification codes in one call. Essential for accurate deal and invoice creation (e.g., taxable 10%, reduced 8%, exempt). Cached for 15 minutes as tax codes rarely change.',
    inputSchema: schemas.GetTaxCodesSchema,
  },
  async ({ companyId, compact }) => {
    try {
      const taxCodes = await freeeClient.getTaxCodes(getCompanyId(companyId));
      const formatted = ResponseFormatter.formatTaxCodes(taxCodes, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_tax_codes', error);
    }
  },
);

// === Segment Tag tools ===

registerTool(
  'freee_get_segment_tags',
  {
    description:
      'Get list of segment tags (セグメントタグ) for multi-axis analysis - Retrieves segment tags (タグ1-3) used for department/project tracking. Use with profit_loss breakdown for segment-based P&L analysis. Requires paid freee plan. Different from regular tags (freee_get_tags): segment tags enable up to 3 independent classification axes.',
    inputSchema: schemas.GetSegmentTagsSchema,
  },
  async ({ companyId, segmentId, offset, limit, compact }) => {
    try {
      const tags = await freeeClient.getSegmentTags(
        getCompanyId(companyId),
        segmentId,
        { offset, limit },
      );
      const formatted = ResponseFormatter.formatSegmentTags(tags, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_segment_tags', error);
    }
  },
);

registerTool(
  'freee_create_segment_tag',
  {
    description:
      'Create a new segment tag (セグメントタグ) - Creates a tag under segment 1-3 for department/project classification. Requires paid freee plan.',
    inputSchema: schemas.CreateSegmentTagSchema,
  },
  async ({ companyId, segmentId, name, description, shortcut1, shortcut2 }) => {
    try {
      const tag = await freeeClient.createSegmentTag(
        getCompanyId(companyId),
        segmentId,
        { name, description, shortcut1, shortcut2 },
      );
      const formatted = ResponseFormatter.formatSegmentTag(tag);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_segment_tag', error);
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
    compact,
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
      const formatted = ResponseFormatter.formatInvoices(invoices, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
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

// === Walletable tools ===

registerTool(
  'freee_get_walletables',
  {
    description:
      'Get list of bank accounts, credit cards, and wallets - Retrieves all walletable accounts in one call. Use with withBalance=true to check current cash position across all accounts. For aggregated financial analysis, prefer balance_sheet API. Use this for account-level balance checks and cash management.',
    inputSchema: schemas.GetWalletablesSchema,
  },
  async ({ companyId, withBalance }) => {
    try {
      const walletables = await freeeClient.getWalletables(
        getCompanyId(companyId),
        {
          with_balance: withBalance,
        },
      );
      const formatted = ResponseFormatter.formatWalletables(walletables);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_walletables', error);
    }
  },
);

// === Manual Journal tools ===

registerTool(
  'freee_get_manual_journals',
  {
    description:
      'Get list of manual journal entries (振替伝票) - Supports rich filtering by date range, entry side, account, amount range, partner, and section. Max 500 records per page. For aggregated totals, prefer report APIs (profit_loss, trial_balance). Use this for reviewing individual accruals, adjustments, and reclassifications.',
    inputSchema: schemas.GetManualJournalsSchema,
  },
  async ({
    companyId,
    startIssueDate,
    endIssueDate,
    entrySide,
    accountItemId,
    minAmount,
    maxAmount,
    partnerId,
    sectionId,
    offset,
    limit,
  }) => {
    try {
      const journals = await freeeClient.getManualJournals(
        getCompanyId(companyId),
        {
          start_issue_date: startIssueDate,
          end_issue_date: endIssueDate,
          entry_side: entrySide,
          account_item_id: accountItemId,
          min_amount: minAmount,
          max_amount: maxAmount,
          partner_id: partnerId,
          section_id: sectionId,
          offset,
          limit,
        },
      );
      const formatted = ResponseFormatter.formatManualJournals(journals);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_manual_journals', error);
    }
  },
);

registerTool(
  'freee_get_manual_journal',
  {
    description:
      'Get specific manual journal entry details - Retrieves full details of a single manual journal including all debit/credit line items.',
    inputSchema: schemas.GetManualJournalSchema,
  },
  async ({ companyId, manualJournalId }) => {
    try {
      const journal = await freeeClient.getManualJournal(
        getCompanyId(companyId),
        manualJournalId,
      );
      const formatted = ResponseFormatter.formatManualJournal(journal);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_manual_journal', error);
    }
  },
);

registerTool(
  'freee_create_manual_journal',
  {
    description:
      'Create a manual journal entry (振替伝票) - Creates a new manual journal with debit/credit entries. Essential for closing adjustments (決算整理仕訳) like depreciation, prepaid expense allocation, and provision entries. Set adjustment=true to mark as closing adjustment. Debit and credit totals must balance.',
    inputSchema: schemas.CreateManualJournalSchema,
  },
  async ({ companyId, issueDate, adjustment, details }) => {
    try {
      // Validate debit/credit balance (single-pass)
      const { debitTotal, creditTotal } = details.reduce(
        (
          totals: { debitTotal: number; creditTotal: number },
          d: { entrySide: string; amount: number },
        ) => {
          if (d.entrySide === 'debit') {
            totals.debitTotal += d.amount;
          } else if (d.entrySide === 'credit') {
            totals.creditTotal += d.amount;
          }
          return totals;
        },
        { debitTotal: 0, creditTotal: 0 },
      );

      if (debitTotal !== creditTotal) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Debit total (${debitTotal}) and credit total (${creditTotal}) must match.`,
        );
      }

      if (debitTotal === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Journal must contain at least one debit and one credit entry.',
        );
      }

      const journal = await freeeClient.createManualJournal(
        getCompanyId(companyId),
        {
          issue_date: issueDate,
          adjustment: adjustment ?? false,
          details: details.map(
            (d: {
              entrySide: string;
              accountItemId: number;
              taxCode: number;
              amount: number;
              description?: string;
              sectionId?: number;
              tagIds?: number[];
              partnerId?: number;
            }) => ({
              entry_side: d.entrySide as 'debit' | 'credit',
              account_item_id: d.accountItemId,
              tax_code: d.taxCode,
              amount: d.amount,
              description: d.description,
              section_id: d.sectionId,
              tag_ids: d.tagIds,
              partner_id: d.partnerId,
            }),
          ),
        },
      );
      const formatted = ResponseFormatter.formatManualJournal(journal);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_manual_journal', error);
    }
  },
);

// === Wallet Transaction tools ===

registerTool(
  'freee_get_wallet_txns',
  {
    description:
      'Get list of wallet transactions (口座明細) - Retrieves bank/credit card/wallet transaction entries. Requires walletableType and walletableId for specific account filtering. Use freee_get_walletables first to get account IDs. Max 100 records per page. For cash flow analysis, consider report APIs for aggregated data.',
    inputSchema: schemas.GetWalletTxnsSchema,
  },
  async ({
    companyId,
    walletableType,
    walletableId,
    startDate,
    endDate,
    entrySide,
    offset,
    limit,
  }) => {
    try {
      const txns = await freeeClient.getWalletTxns(getCompanyId(companyId), {
        walletable_type: walletableType,
        walletable_id: walletableId,
        start_date: startDate,
        end_date: endDate,
        entry_side: entrySide,
        offset,
        limit,
      });
      const formatted = ResponseFormatter.formatWalletTransactions(txns);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_wallet_txns', error);
    }
  },
);

// === Transfer tools ===

registerTool(
  'freee_get_transfers',
  {
    description:
      'Get list of bank transfers (口座振替) - Retrieves fund movement records between bank accounts, credit cards, and wallets. Supports date range and account filtering with pagination. Use freee_get_walletables first to get account IDs. Max 100 records per page.',
    inputSchema: schemas.GetTransfersSchema,
  },
  async ({
    companyId,
    startDate,
    endDate,
    walletableId,
    walletableType,
    offset,
    limit,
  }) => {
    try {
      const transfers = await freeeClient.getTransfers(
        getCompanyId(companyId),
        {
          start_date: startDate,
          end_date: endDate,
          walletable_id: walletableId,
          walletable_type: walletableType,
          offset,
          limit,
        },
      );
      const formatted = ResponseFormatter.formatTransfers(transfers);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_transfers', error);
    }
  },
);

registerTool(
  'freee_get_transfer',
  {
    description:
      'Get specific bank transfer details - Retrieves full details of a single fund transfer between accounts by ID.',
    inputSchema: schemas.GetTransferSchema,
  },
  async ({ companyId, transferId }) => {
    try {
      const transfer = await freeeClient.getTransfer(
        getCompanyId(companyId),
        transferId,
      );
      const formatted = ResponseFormatter.formatTransfer(transfer);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_transfer', error);
    }
  },
);

registerTool(
  'freee_create_transfer',
  {
    description:
      'Create a new bank transfer (口座振替) - Records a fund movement between accounts. Requires source and destination account IDs/types (use freee_get_walletables to look up). Supports bank_account, credit_card, and wallet types.',
    inputSchema: schemas.CreateTransferSchema,
  },
  async ({
    companyId,
    date,
    amount,
    fromWalletableId,
    fromWalletableType,
    toWalletableId,
    toWalletableType,
    description,
  }) => {
    try {
      const transfer = await freeeClient.createTransfer(
        getCompanyId(companyId),
        {
          date,
          amount,
          from_walletable_id: fromWalletableId,
          from_walletable_type: fromWalletableType,
          to_walletable_id: toWalletableId,
          to_walletable_type: toWalletableType,
          description,
        },
      );
      const formatted = ResponseFormatter.formatTransfer(transfer);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_create_transfer', error);
    }
  },
);

// === Expense Application tools ===

registerTool(
  'freee_get_expense_applications',
  {
    description:
      'Get list of expense applications (経費精算申請) - Retrieves expense reports with filtering by status, date, applicant, approver, and amount. Supports approval workflow visibility. Use compact mode for summary statistics only.',
    inputSchema: schemas.GetExpenseApplicationsSchema,
  },
  async ({
    companyId,
    status,
    startIssueDate,
    endIssueDate,
    startTransactionDate,
    endTransactionDate,
    applicantId,
    approverId,
    minAmount,
    maxAmount,
    offset,
    limit,
    compact,
  }) => {
    try {
      const apps = await freeeClient.getExpenseApplications(
        getCompanyId(companyId),
        {
          status,
          start_issue_date: startIssueDate,
          end_issue_date: endIssueDate,
          start_transaction_date: startTransactionDate,
          end_transaction_date: endTransactionDate,
          applicant_id: applicantId,
          approver_id: approverId,
          min_amount: minAmount,
          max_amount: maxAmount,
          offset,
          limit,
        },
      );
      const formatted = ResponseFormatter.formatExpenseApplications(
        apps,
        compact,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_expense_applications', error);
    }
  },
);

registerTool(
  'freee_get_expense_application',
  {
    description:
      'Get specific expense application details (経費精算申請詳細) - Retrieves full details including line items, approvers, comments, and approval flow logs. Use this to get current_step_id and current_round needed for approval actions.',
    inputSchema: schemas.GetExpenseApplicationSchema,
  },
  async ({ companyId, expenseApplicationId }) => {
    try {
      const app = await freeeClient.getExpenseApplication(
        getCompanyId(companyId),
        expenseApplicationId,
      );
      const formatted = ResponseFormatter.formatExpenseApplication(app);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_expense_application', error);
    }
  },
);

registerTool(
  'freee_approve_expense_application',
  {
    description:
      'Approve, reject, or send back an expense application (経費精算承認) - Executes approval workflow actions. Requires target_step_id and target_round from the expense application detail (use freee_get_expense_application first). Actions: approve (承認), reject (却下), feedback (差戻し).',
    inputSchema: schemas.ApproveExpenseApplicationSchema,
  },
  async ({
    companyId,
    expenseApplicationId,
    approvalAction,
    targetStepId,
    targetRound,
  }) => {
    try {
      const app = await freeeClient.approveExpenseApplication(
        getCompanyId(companyId),
        expenseApplicationId,
        {
          approval_action: approvalAction,
          target_step_id: targetStepId,
          target_round: targetRound,
        },
      );
      const formatted = ResponseFormatter.formatExpenseApplication(app);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_approve_expense_application', error);
    }
  },
);

// === Receipt tools ===

registerTool(
  'freee_get_receipts',
  {
    description:
      'Get list of receipts (証憑) for electronic bookkeeping compliance (電子帳簿保存法) - Retrieves uploaded receipt images/PDFs with filtering by date, user, and status. Use compact mode for summary statistics only. Max 100 records per page.',
    inputSchema: schemas.GetReceiptsSchema,
  },
  async ({
    companyId,
    startDate,
    endDate,
    userName,
    status,
    offset,
    limit,
    compact,
  }) => {
    try {
      const receipts = await freeeClient.getReceipts(getCompanyId(companyId), {
        start_date: startDate,
        end_date: endDate,
        user_name: userName,
        status,
        offset,
        limit,
      });
      const formatted = ResponseFormatter.formatReceipts(receipts, compact);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_receipts', error);
    }
  },
);

registerTool(
  'freee_get_receipt',
  {
    description:
      'Get specific receipt details (証憑詳細) - Retrieves full details of a single receipt including file URL, issue date, user info, and qualified invoice status. Use for individual receipt inspection and compliance verification.',
    inputSchema: schemas.GetReceiptSchema,
  },
  async ({ companyId, receiptId }) => {
    try {
      const receipt = await freeeClient.getReceipt(
        getCompanyId(companyId),
        receiptId,
      );
      const formatted = ResponseFormatter.formatReceipt(receipt);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_receipt', error);
    }
  },
);

// === Search/Aggregation tools ===

registerTool(
  'freee_search_deals',
  {
    description:
      'Search and aggregate all deals - Auto-paginates through all matching deals and returns pre-computed summaries by partner, month, and account item. Use this instead of manual pagination with freee_get_deals for financial analysis. Returns aggregated totals, not individual records.',
    inputSchema: schemas.SearchDealsSchema,
  },
  async ({
    companyId,
    partnerId,
    accountItemId,
    startIssueDate,
    endIssueDate,
    maxRecords,
  }) => {
    try {
      const aggregation = await freeeClient.searchDeals(
        getCompanyId(companyId),
        {
          partner_id: partnerId,
          account_item_id: accountItemId,
          start_issue_date: startIssueDate,
          end_issue_date: endIssueDate,
        },
        maxRecords,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(aggregation, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_search_deals', error);
    }
  },
);

registerTool(
  'freee_summarize_invoices',
  {
    description:
      'Summarize all invoices with payment status breakdown - Auto-paginates through all matching invoices and returns pre-computed summaries by status and partner. Shows total amounts, unpaid amounts, and overdue counts. Use this for AR tracking and cash flow analysis instead of manual pagination.',
    inputSchema: schemas.SummarizeInvoicesSchema,
  },
  async ({
    companyId,
    partnerId,
    invoiceStatus,
    paymentStatus,
    startIssueDate,
    endIssueDate,
    maxRecords,
  }) => {
    try {
      const summary = await freeeClient.summarizeInvoices(
        getCompanyId(companyId),
        {
          partner_id: partnerId,
          invoice_status: invoiceStatus,
          payment_status: paymentStatus,
          start_issue_date: startIssueDate,
          end_issue_date: endIssueDate,
        },
        maxRecords,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_summarize_invoices', error);
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

// === Analysis tools ===

registerTool(
  'freee_compare_periods',
  {
    description:
      'Compare two financial periods with pre-computed diffs and percentages - Single call for YoY/MoM analysis. Returns metrics for both periods, absolute and percentage changes, and significance highlights. Eliminates LLM-side math for period comparisons.',
    inputSchema: schemas.ComparePeriodsSchema,
  },
  async ({ companyId, reportType, period1, period2, breakdownDisplayType }) => {
    try {
      const comparison = await freeeClient.comparePeriods(
        getCompanyId(companyId),
        reportType,
        {
          fiscal_year: period1.fiscalYear,
          start_month: period1.startMonth,
          end_month: period1.endMonth,
        },
        {
          fiscal_year: period2.fiscalYear,
          start_month: period2.startMonth,
          end_month: period2.endMonth,
        },
        breakdownDisplayType,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(comparison, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_compare_periods', error);
    }
  },
);

registerTool(
  'freee_monthly_trends',
  {
    description:
      'Get monthly financial trends with summary statistics - Single call returns monthly P&L or BS data with pre-computed averages, max/min, and trend direction. Replaces 12 separate API calls and LLM-side trend analysis.',
    inputSchema: schemas.MonthlyTrendsSchema,
  },
  async ({ companyId, fiscalYear, reportType, months }) => {
    try {
      const trends = await freeeClient.getMonthlyTrends(
        getCompanyId(companyId),
        fiscalYear,
        reportType,
        months,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(trends, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_monthly_trends', error);
    }
  },
);

registerTool(
  'freee_cash_position',
  {
    description:
      'Get consolidated cash position overview - Single call combines walletable balances, unpaid invoices (receivables), and unsettled expense deals (payables) into one summary. Provides total cash, net position, and overdue amounts for quick financial health assessment.',
    inputSchema: schemas.CashPositionSchema,
  },
  async ({ companyId }) => {
    try {
      const cashPosition = await freeeClient.getCashPosition(
        getCompanyId(companyId),
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(cashPosition, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_cash_position', error);
    }
  },
);

registerTool(
  'freee_monthly_closing_check',
  {
    description:
      'Run monthly closing checklist (月次決算チェックリスト) - Executes up to 6 automated checks for a given month: unprocessed bank transactions, cash/deposit balance verification against walletables, temporary account (仮払金/仮受金/立替金) review, receivable aging, payable aging, and unattached receipts. Returns per-check status (ok/warning/error) with details and an overall assessment. Use after month-end to identify outstanding items before closing.',
    inputSchema: schemas.MonthlyClosingCheckSchema,
  },
  async ({ companyId, year, month, checks }) => {
    try {
      const result = await freeeClient.getMonthlyClosingChecklist(
        getCompanyId(companyId),
        year,
        month,
        checks,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_monthly_closing_check', error);
    }
  },
);

// === Journal tools (async download API) ===

registerTool(
  'freee_get_journals',
  {
    description:
      'Get journal entries (仕訳帳) for a date range - Downloads all journal entries including deals, manual journals, and auto-generated entries. Uses async download API internally (request → poll → download). Ideal for monthly closing verification, anomaly detection (duplicate entries, unusual accounts), and comprehensive audit review. Returns structured data parsed from CSV. Note: may take 10-30 seconds for large date ranges.',
    inputSchema: schemas.GetJournalsSchema,
  },
  async ({ companyId, startDate, endDate, visibleTags, visibleIds }) => {
    try {
      const entries = await freeeClient.getJournals(getCompanyId(companyId), {
        start_date: startDate,
        end_date: endDate,
        visible_tags: visibleTags,
        visible_ids: visibleIds,
      });
      const formatted = ResponseFormatter.formatJournalEntries(entries);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      handleToolError('freee_get_journals', error);
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
