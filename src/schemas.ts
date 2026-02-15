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

export const UpdateDealSchema = {
  companyId: companyIdField,
  dealId: z.number().describe('Deal ID to update'),
  issueDate: z.string().optional().describe('Issue date (YYYY-MM-DD)'),
  type: z.enum(['income', 'expense']).optional().describe('Transaction type'),
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
    .optional()
    .describe('Transaction details (replaces all existing details)'),
};

export const CreateDealPaymentSchema = {
  companyId: companyIdField,
  dealId: z.number().describe('Deal ID to add payment to'),
  date: z.string().describe('Payment date (YYYY-MM-DD)'),
  fromWalletableId: z.number().describe('Source wallet account ID'),
  fromWalletableType: z
    .enum(['bank_account', 'credit_card', 'wallet'])
    .describe('Source wallet account type'),
  amount: z.number().describe('Payment amount'),
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

// Segment Tag schemas
export const GetSegmentTagsSchema = {
  companyId: companyIdField,
  segmentId: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .describe('Segment number (1-3): タグ1, タグ2, タグ3'),
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

export const CreateSegmentTagSchema = {
  companyId: companyIdField,
  segmentId: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .describe('Segment number (1-3): タグ1, タグ2, タグ3'),
  name: z.string().describe('Segment tag name'),
  description: z.string().optional().describe('Description'),
  shortcut1: z.string().optional().describe('Shortcut 1'),
  shortcut2: z.string().optional().describe('Shortcut 2'),
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

// Walletable schemas
export const GetWalletablesSchema = {
  companyId: companyIdField,
  withBalance: z
    .boolean()
    .optional()
    .describe(
      'When true, includes current balance for each account. Useful for cash position analysis.',
    ),
};

// Manual Journal schemas
export const GetManualJournalsSchema = {
  companyId: companyIdField,
  startIssueDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  entrySide: z
    .enum(['debit', 'credit'])
    .optional()
    .describe('Filter by entry side'),
  accountItemId: z.number().optional().describe('Account item ID to filter by'),
  minAmount: z.number().optional().describe('Minimum amount filter'),
  maxAmount: z.number().optional().describe('Maximum amount filter'),
  partnerId: z.number().optional().describe('Partner ID to filter by'),
  sectionId: z.number().optional().describe('Section ID to filter by'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(500)
    .optional()
    .describe('Number of results (1-500, default 100)'),
};

export const GetManualJournalSchema = {
  companyId: companyIdField,
  manualJournalId: z.number().describe('Manual journal ID'),
};

export const CreateManualJournalSchema = {
  companyId: companyIdField,
  issueDate: z.string().describe('Issue date (YYYY-MM-DD)'),
  adjustment: z
    .boolean()
    .optional()
    .describe(
      'Whether this is a closing adjustment entry (決算整理仕訳). Defaults to false.',
    ),
  details: z
    .array(
      z.object({
        entrySide: z
          .enum(['debit', 'credit'])
          .describe('Entry side (debit=借方, credit=貸方)'),
        accountItemId: z.number().describe('Account item ID (勘定科目ID)'),
        taxCode: z.number().describe('Tax code (税区分コード)'),
        amount: z.number().min(1).describe('Amount (金額, must be positive)'),
        description: z.string().optional().describe('Description (摘要)'),
        sectionId: z.number().optional().describe('Section ID (部門ID)'),
        tagIds: z.array(z.number()).optional().describe('Tag IDs (メモタグID)'),
        partnerId: z.number().optional().describe('Partner ID (取引先ID)'),
      }),
    )
    .min(2)
    .describe(
      'Journal entry details — must include at least one debit and one credit entry with matching totals',
    ),
};

// Wallet Transaction schemas
export const GetWalletTxnsSchema = {
  companyId: companyIdField,
  walletableType: z
    .enum(['bank_account', 'credit_card', 'wallet'])
    .optional()
    .describe('Type of wallet account to filter'),
  walletableId: z.number().optional().describe('Wallet account ID to filter'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  entrySide: z
    .enum(['income', 'expense'])
    .optional()
    .describe('Filter by income or expense'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100)'),
};

// Transfer schemas
export const GetTransfersSchema = {
  companyId: companyIdField,
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  walletableId: z
    .number()
    .optional()
    .describe('Filter by walletable account ID'),
  walletableType: z
    .enum(['bank_account', 'credit_card', 'wallet'])
    .optional()
    .describe('Filter by walletable account type'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100)'),
};

export const GetTransferSchema = {
  companyId: companyIdField,
  transferId: z.number().describe('Transfer ID'),
};

export const CreateTransferSchema = {
  companyId: companyIdField,
  date: z.string().describe('Transfer date (YYYY-MM-DD)'),
  amount: z.number().describe('Transfer amount'),
  fromWalletableId: z.number().describe('Source walletable account ID'),
  fromWalletableType: z
    .enum(['bank_account', 'credit_card', 'wallet'])
    .describe('Source walletable account type'),
  toWalletableId: z.number().describe('Destination walletable account ID'),
  toWalletableType: z
    .enum(['bank_account', 'credit_card', 'wallet'])
    .describe('Destination walletable account type'),
  description: z.string().optional().describe('Transfer description/memo'),
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

// Analysis schemas
export const ComparePeriodsSchema = {
  companyId: companyIdField,
  reportType: z
    .enum(['profit_loss', 'balance_sheet'])
    .describe('Type of financial report to compare'),
  period1: z
    .object({
      fiscalYear: z.number().describe('Fiscal year'),
      startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
      endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
    })
    .describe('First period to compare'),
  period2: z
    .object({
      fiscalYear: z.number().describe('Fiscal year'),
      startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
      endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
    })
    .describe('Second period to compare'),
  breakdownDisplayType: z
    .enum(['partner', 'item', 'section', 'tag'])
    .optional()
    .describe('Breakdown display type'),
};

export const MonthlyTrendsSchema = {
  companyId: companyIdField,
  fiscalYear: z.number().describe('Fiscal year'),
  reportType: z
    .enum(['profit_loss', 'balance_sheet'])
    .describe('Type of financial report'),
  months: z
    .array(z.number().min(1).max(12))
    .optional()
    .describe('Specific months to include (1-12). Defaults to all 12 months.'),
};

export const CashPositionSchema = {
  companyId: companyIdField,
};

// Expense Application schemas
export const GetExpenseApplicationsSchema = {
  companyId: companyIdField,
  status: z
    .enum(['draft', 'in_progress', 'approved', 'rejected', 'feedback'])
    .optional()
    .describe(
      'Filter by status (draft: 下書き, in_progress: 申請中, approved: 承認済, rejected: 却下, feedback: 差戻し)',
    ),
  startIssueDate: z
    .string()
    .optional()
    .describe('Start issue date (YYYY-MM-DD)'),
  endIssueDate: z.string().optional().describe('End issue date (YYYY-MM-DD)'),
  startTransactionDate: z
    .string()
    .optional()
    .describe('Start transaction date for line items (YYYY-MM-DD)'),
  endTransactionDate: z
    .string()
    .optional()
    .describe('End transaction date for line items (YYYY-MM-DD)'),
  applicantId: z.number().optional().describe('Applicant user ID to filter by'),
  approverId: z.number().optional().describe('Approver user ID to filter by'),
  minAmount: z.number().optional().describe('Minimum total amount filter'),
  maxAmount: z.number().optional().describe('Maximum total amount filter'),
  offset: z.number().optional().describe('Pagination offset'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results (1-100, default 50)'),
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};

export const GetExpenseApplicationSchema = {
  companyId: companyIdField,
  expenseApplicationId: z.number().describe('Expense application ID'),
};

export const ApproveExpenseApplicationSchema = {
  companyId: companyIdField,
  expenseApplicationId: z.number().describe('Expense application ID'),
  approvalAction: z
    .enum(['approve', 'reject', 'feedback'])
    .describe(
      'Approval action (approve: 承認する, reject: 却下する, feedback: 差し戻す)',
    ),
  targetStepId: z
    .number()
    .describe(
      'Target approval step ID (from expense application detail current_step_id)',
    ),
  targetRound: z
    .number()
    .describe(
      'Target round number (from expense application detail current_round)',
    ),
};

// Monthly Closing Check schemas
export const MonthlyClosingCheckSchema = {
  companyId: companyIdField,
  year: z.number().describe('Fiscal year'),
  month: z.number().min(1).max(12).describe('Month to check (1-12)'),
  checks: z
    .array(
      z.enum([
        'unprocessed_transactions',
        'balance_verification',
        'temporary_accounts',
        'receivable_aging',
        'payable_aging',
        'unattached_receipts',
      ]),
    )
    .optional()
    .describe(
      'Check types to execute (all if omitted): unprocessed_transactions, balance_verification, temporary_accounts, receivable_aging, payable_aging, unattached_receipts',
    ),
};

// Journal schemas (async download API)
export const GetJournalsSchema = {
  companyId: companyIdField,
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
  visibleTags: z
    .array(
      z.enum([
        'partner',
        'item',
        'tag',
        'section',
        'description',
        'wallet_txn_description',
        'all',
        'segment_1_tag',
        'segment_2_tag',
        'segment_3_tag',
      ]),
    )
    .optional()
    .describe(
      'Additional fields to include in output (partner, item, tag, section, description, all, etc.). Defaults to ["all"].',
    ),
  visibleIds: z
    .array(z.enum(['deal_id', 'transfer_id', 'manual_journal_id']))
    .optional()
    .describe(
      'Additional ID fields to include (deal_id, transfer_id, manual_journal_id)',
    ),
};

// Tax Code schemas
export const GetTaxCodesSchema = {
  companyId: companyIdField,
  compact: z
    .boolean()
    .optional()
    .describe(
      'When true, returns summary statistics only without individual records. Useful for quick overviews.',
    ),
};
