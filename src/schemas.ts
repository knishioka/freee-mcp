import { z } from 'zod';

// Common field descriptions
const companyIdField = z
  .number()
  .optional()
  .describe(
    'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)',
  );

// Auth schemas
export const AuthorizeSchema = {
  state: z
    .string()
    .optional()
    .describe('Optional state parameter for CSRF protection'),
};

export const GetTokenSchema = {
  code: z.string().describe('Authorization code from OAuth flow'),
};

export const SetCompanyTokenSchema = {
  companyId: z.number().describe('Company ID to set token for'),
  accessToken: z.string().describe('OAuth access token'),
  refreshToken: z.string().describe('OAuth refresh token'),
  expiresIn: z.number().describe('Token expiration time in seconds'),
};

// Company schemas
export const GetCompaniesSchema = {};

export const GetCompanySchema = {
  companyId: companyIdField,
};

// Deal schemas
export const GetDealsSchema = {
  companyId: companyIdField,
  partnerId: z.number().optional().describe('Partner ID to filter by'),
  accountItemId: z.number().optional().describe('Account item ID to filter by'),
  startIssueDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100)'),
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

export const GetDealSchema = {
  companyId: companyIdField,
  dealId: z.number().describe('Deal ID'),
};

export const CreateDealSchema = {
  companyId: companyIdField,
  issueDate: z.string().describe('Issue date (YYYY-MM-DD)'),
  type: z.enum(['income', 'expense']).describe('Transaction type'),
  partnerId: z.number().optional().describe('Partner ID'),
  dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
  refNumber: z.string().optional().describe('Reference number'),
  details: z
    .array(
      z.object({
        accountItemId: z.number().describe('Account item ID'),
        taxCode: z.number().describe('Tax code'),
        amount: z.number().describe('Amount'),
        description: z.string().optional().describe('Description'),
        sectionId: z.number().optional().describe('Section ID'),
        tagIds: z.array(z.number()).optional().describe('Tag IDs'),
      }),
    )
    .describe('Transaction details'),
};

// Account Item schemas
export const GetAccountItemsSchema = {
  companyId: companyIdField,
  accountCategory: z
    .string()
    .optional()
    .describe('Account category to filter by'),
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

// Partner schemas
export const GetPartnersSchema = {
  companyId: companyIdField,
  name: z.string().optional().describe('Partner name to search'),
  shortcut1: z.string().optional().describe('Shortcut 1 to search'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100)'),
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

export const CreatePartnerSchema = {
  companyId: companyIdField,
  name: z.string().describe('Partner name'),
  shortcut1: z.string().optional().describe('Shortcut 1'),
  shortcut2: z.string().optional().describe('Shortcut 2'),
  longName: z.string().optional().describe('Long name'),
  nameKana: z.string().optional().describe('Name in Kana'),
  countryCode: z.string().optional().describe('Country code'),
};

// Section schemas
export const GetSectionsSchema = {
  companyId: companyIdField,
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

// Tag schemas
export const GetTagsSchema = {
  companyId: companyIdField,
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

// Invoice schemas
export const GetInvoicesSchema = {
  companyId: companyIdField,
  partnerId: z.number().optional().describe('Partner ID to filter by'),
  invoiceStatus: z.string().optional().describe('Invoice status to filter by'),
  paymentStatus: z.string().optional().describe('Payment status to filter by'),
  startIssueDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100)'),
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

export const CreateInvoiceSchema = {
  companyId: companyIdField,
  issueDate: z.string().describe('Issue date (YYYY-MM-DD)'),
  partnerId: z.number().describe('Partner ID'),
  dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
  title: z.string().optional().describe('Invoice title'),
  invoiceStatus: z
    .enum(['draft', 'issue', 'sent', 'settled'])
    .describe('Invoice status'),
  invoiceLines: z
    .array(
      z.object({
        name: z.string().describe('Item name'),
        quantity: z.number().describe('Quantity'),
        unitPrice: z.number().describe('Unit price'),
        description: z.string().optional().describe('Description'),
        taxCode: z.number().optional().describe('Tax code'),
        accountItemId: z.number().optional().describe('Account item ID'),
      }),
    )
    .describe('Invoice line items'),
};

// Search/Aggregation schemas
export const SearchDealsSchema = {
  companyId: companyIdField,
  partnerId: z.number().optional().describe('Partner ID to filter by'),
  accountItemId: z.number().optional().describe('Account item ID to filter by'),
  startIssueDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  maxRecords: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum records to fetch (1-1000, default 1000)'),
};

export const SummarizeInvoicesSchema = {
  companyId: companyIdField,
  partnerId: z.number().optional().describe('Partner ID to filter by'),
  invoiceStatus: z.string().optional().describe('Invoice status to filter by'),
  paymentStatus: z.string().optional().describe('Payment status to filter by'),
  startIssueDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  maxRecords: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum records to fetch (1-1000, default 1000)'),
};

// Trial Balance schemas
export const GetTrialBalanceSchema = {
  companyId: companyIdField,
  fiscalYear: z.number().describe('Fiscal year'),
  startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
  endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
};

// Report schemas for financial statements
export const GetProfitLossSchema = {
  companyId: companyIdField,
  fiscalYear: z.number().describe('Fiscal year'),
  startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
  endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
  breakdownDisplayType: z
    .enum(['partner', 'item', 'section', 'tag'])
    .optional()
    .describe('Breakdown display type'),
};

export const GetBalanceSheetSchema = {
  companyId: companyIdField,
  fiscalYear: z.number().describe('Fiscal year'),
  startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
  endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
  breakdownDisplayType: z
    .enum(['partner', 'item', 'section', 'tag'])
    .optional()
    .describe('Breakdown display type'),
};
