export interface FreeeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

export interface FreeeCompany {
  id: number;
  name: string;
  name_kana: string;
  display_name: string;
  role: string;
}

export interface FreeeDeal {
  id: number;
  company_id: number;
  issue_date: string;
  due_date?: string;
  amount: number;
  type: 'income' | 'expense';
  partner_id?: number;
  partner_name?: string;
  ref_number?: string;
  status: string;
  details: FreeeDealDetail[];
}

export interface FreeeDealDetail {
  id?: number;
  account_item_id: number;
  tax_code: number;
  amount: number;
  description?: string;
  item_id?: number;
  section_id?: number;
  tag_ids?: number[];
}

export interface FreeeDealPayment {
  id: number;
  date: string;
  from_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  from_walletable_id: number;
  amount: number;
}

export interface FreeeDealUpdatePayload {
  issue_date?: string;
  type?: 'income' | 'expense';
  details?: Array<Omit<FreeeDealDetail, 'id'>>;
}

export interface FreeeAccountItem {
  id: number;
  company_id: number;
  name: string;
  shortcut?: string;
  account_category: string;
  tax_code?: number;
  available: boolean;
}

export interface FreeePartner {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  long_name?: string;
  name_kana?: string;
  country_code?: string;
  available: boolean;
}

export interface FreeeSection {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  available: boolean;
}

export interface FreeeTag {
  id: number;
  company_id: number;
  name: string;
  shortcut?: string;
  available: boolean;
}

export interface FreeeItem {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  code?: string;
  description?: string;
  available: boolean;
}

export interface FreeeSegmentTag {
  id: number;
  company_id: number;
  name: string;
  description?: string;
  shortcut1?: string;
  shortcut2?: string;
  available: boolean;
}

export const MASTER_CONTEXT_CATEGORIES = [
  'account_items',
  'tags',
  'sections',
  'segments',
  'items',
  'partners',
] as const;

export type MasterContextCategory = (typeof MASTER_CONTEXT_CATEGORIES)[number];

export interface MasterContextResult {
  account_items?: {
    id: number;
    name: string;
    account_category: string;
    tax_code?: number;
  }[];
  tags?: { id: number; name: string }[];
  sections?: { id: number; name: string }[];
  segments?: {
    '1': { id: number; name: string }[];
    '2': { id: number; name: string }[];
    '3': { id: number; name: string }[];
  };
  items?: { id: number; name: string; code?: string }[];
  partners?: { id: number; name: string }[];
}

export interface FreeeInvoice {
  id: number;
  company_id: number;
  issue_date: string;
  due_date?: string;
  partner_id: number;
  partner_name?: string;
  invoice_number: string;
  title?: string;
  total_amount: number;
  invoice_status: 'draft' | 'issue' | 'sent' | 'settled';
  payment_status?: 'empty' | 'unsettled' | 'settled';
  invoice_lines: FreeeInvoiceLine[];
}

export interface FreeeInvoiceLine {
  id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  description?: string;
  tax_code?: number;
  account_item_id?: number;
}

export interface FreeeTrialBalanceItem {
  account_item_id?: number;
  account_item_name: string;
  account_category_name?: string;
  hierarchy_level: number;
  opening_balance: number;
  debit_amount: number;
  credit_amount: number;
  closing_balance: number;
  composition_ratio?: number;
}

export interface FreeeTrialBalance {
  company_id: number;
  fiscal_year: number;
  start_month: number;
  end_month: number;
  created_at: string;
  balances: FreeeTrialBalanceItem[];
}

export interface FreeeWalletable {
  id: number;
  name: string;
  type: 'bank_account' | 'credit_card' | 'wallet';
  bank_id?: number;
  last_balance?: number;
  walletable_balance?: number;
}

export interface FreeeManualJournalDetail {
  id: number;
  entry_side: 'debit' | 'credit';
  account_item_id: number;
  amount: number;
  description?: string;
  section_id?: number;
  tag_ids?: number[];
  partner_id?: number;
  partner_name?: string;
}

export interface FreeeManualJournal {
  id: number;
  company_id: number;
  issue_date: string;
  adjustment: boolean;
  txn_number?: string;
  details: FreeeManualJournalDetail[];
}

export interface FreeeWalletTransaction {
  id: number;
  company_id: number;
  date: string;
  amount: number;
  due_amount: number;
  balance?: number;
  entry_side: 'income' | 'expense';
  walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  walletable_id: number;
  description?: string;
  /** ステータス(1: 未対応, 2: 確認済み, 3: 登録済み, 4: 登録済み（古）, 5: 無視) */
  status: number;
}

export interface FreeeTaxCode {
  code: number;
  name: string;
  name_ja: string;
}

export interface FreeeTransfer {
  id: number;
  company_id: number;
  date: string;
  amount: number;
  from_walletable_id: number;
  from_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  to_walletable_id: number;
  to_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  description?: string;
}

export interface FreeeExpenseApplicationLine {
  id: number;
  description?: string;
  amount: number;
  expense_application_line_template_id?: number;
}

export interface FreeeExpenseApplicationPurchaseLine {
  id: number;
  transaction_date?: string;
  receipt_id?: number;
  expense_application_lines: FreeeExpenseApplicationLine[];
}

export interface FreeeExpenseApplicationApprover {
  step_id: number;
  user_id: number;
  status: string;
  is_force_action: boolean;
  resource_type: string;
}

export interface FreeeExpenseApplicationComment {
  comment: string;
  user_id: number;
  posted_at: string;
}

export interface FreeeExpenseApplicationFlowLog {
  action: string;
  user_id: number;
  updated_at: string;
}

export interface FreeeExpenseApplication {
  id: number;
  company_id: number;
  title: string;
  issue_date: string;
  description?: string;
  total_amount: number;
  status: 'draft' | 'in_progress' | 'approved' | 'rejected' | 'feedback';
  section_id?: number;
  tag_ids?: number[];
  purchase_lines: FreeeExpenseApplicationPurchaseLine[];
  deal_id?: number;
  deal_status?: string;
  applicant_id: number;
  application_number: string;
  approval_flow_route_id: number;
  current_step_id?: number;
  current_round: number;
  approvers?: FreeeExpenseApplicationApprover[];
  comments?: FreeeExpenseApplicationComment[];
  approval_flow_logs?: FreeeExpenseApplicationFlowLog[];
}

// Monthly closing check types

export type MonthlyClosingCheckType =
  | 'unprocessed_transactions'
  | 'balance_verification'
  | 'temporary_accounts'
  | 'receivable_aging'
  | 'payable_aging'
  | 'unattached_receipts';

export interface MonthlyClosingCheckItem {
  name: string;
  status: 'ok' | 'warning' | 'error';
  details: string;
  items?: unknown[];
}

export interface MonthlyClosingCheckResult {
  period: string;
  overall_status: 'ok' | 'warning' | 'error';
  checks: MonthlyClosingCheckItem[];
  summary: string;
}

export interface FreeeReceiptUser {
  id: number;
  email: string;
  display_name?: string;
}

export interface FreeeReceipt {
  id: number;
  status: 'unconfirmed' | 'confirmed' | 'deleted';
  description?: string;
  mime_type?: string;
  issue_date?: string;
  origin?: string;
  created_at: string;
  file_src?: string;
  user: FreeeReceiptUser;
  receipt_metadatum?: {
    id: number;
  };
  qualified_invoice?: string;
}

// Journal download types (async API)
export interface FreeeJournalDownloadRequest {
  id: number;
  company_id: number;
  download_type: 'generic' | 'generic_v2' | 'csv' | 'pdf';
  encoding?: 'sjis' | 'utf-8' | null;
  start_date?: string;
  end_date?: string;
  visible_tags?: string[];
  visible_ids?: string[];
  status_url: string;
  up_to_date: boolean;
  up_to_date_reasons?: Array<{
    code: string;
    message: string;
  }>;
  messages?: string[];
}

export interface FreeeJournalDownloadStatus {
  id: number;
  company_id: number;
  download_type: string;
  status: 'enqueued' | 'working' | 'uploaded' | 'failed';
  start_date: string;
  end_date: string;
  download_url?: string;
}

export interface FreeeJournalEntry {
  date: string;
  txn_number: string;
  detail_number: string;
  debit_account_item: string;
  debit_amount: number;
  credit_account_item: string;
  credit_amount: number;
  description?: string;
  partner?: string;
  source_type?: string;
}

// General Ledger types
export interface FreeeGeneralLedgerItem {
  account_item_id: number;
  account_item_name: string;
  partners: FreeeGeneralLedgerPartner[];
}

export interface FreeeGeneralLedgerPartner {
  partner_id: number | null;
  partner_name: string;
  entries: FreeeGeneralLedgerEntry[];
}

export interface FreeeGeneralLedgerEntry {
  date: string;
  entry_side: 'debit' | 'credit';
  amount: number;
  balance: number;
  description?: string;
  partner_id?: number;
  partner_name?: string;
  txn_number?: string;
}

export interface FreeeGeneralLedger {
  company_id: number;
  fiscal_year: number;
  start_month: number;
  end_month: number;
  general_ledger_items: FreeeGeneralLedgerItem[];
}

export interface FreeeApiError {
  status_code: number;
  errors: Array<{
    type: string;
    messages: string[];
  }>;
}

/** freee API error response for authentication and OAuth errors */
export interface FreeeErrorResponse {
  code?: string;
  error?: string;
  error_description?: string;
  message?: string;
  status_code?: number;
}

// Formatted response types for LLM-optimized output

export interface FormattedDealDetail {
  account_item_id: number;
  amount: number;
  tax_code: number;
  description?: string;
  section_id?: number;
  tag_ids?: number[];
}

export interface FormattedDeal {
  id: number;
  issue_date: string;
  type: 'income' | 'expense';
  amount: number;
  partner_name?: string;
  status: string;
  due_date?: string;
  details?: FormattedDealDetail[];
}

export interface FormattedInvoice {
  id: number;
  issue_date: string;
  invoice_number: string;
  total_amount: number;
  partner_name?: string;
  invoice_status: string;
  payment_status?: string;
  title?: string;
  due_date?: string;
  invoice_lines?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    amount?: number;
    description?: string;
  }>;
}

export interface FormattedPartner {
  id: number;
  name: string;
  shortcut1?: string;
  long_name?: string;
  contact_name?: string;
}

export interface FormattedAccountItem {
  id: number;
  name: string;
  shortcut?: string;
  account_category: string;
  tax_code?: number;
}

export interface FormattedSection {
  id: number;
  name: string;
  shortcut1?: string;
}

export interface FormattedTag {
  id: number;
  name: string;
  shortcut?: string;
}

export interface FormattedTaxCode {
  code: number;
  name: string;
  name_ja: string;
}

export interface FormattedItem {
  id: number;
  name: string;
  shortcut1?: string;
  code?: string;
  description?: string;
}

export interface FormattedSegmentTag {
  id: number;
  name: string;
  description?: string;
  shortcut1?: string;
}

export interface FormattedWalletable {
  id: number;
  name: string;
  type: 'bank_account' | 'credit_card' | 'wallet';
  last_balance?: number;
  walletable_balance?: number;
}

export interface FormattedManualJournalDetail {
  entry_side: 'debit' | 'credit';
  account_item_id: number;
  amount: number;
  description?: string;
  section_id?: number;
  tag_ids?: number[];
  partner_name?: string;
}

export interface FormattedManualJournal {
  id: number;
  issue_date: string;
  adjustment: boolean;
  txn_number?: string;
  details: FormattedManualJournalDetail[];
}

export interface FormattedWalletTransaction {
  id: number;
  date: string;
  amount: number;
  due_amount: number;
  balance?: number;
  entry_side: 'income' | 'expense';
  walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  walletable_id: number;
  description?: string;
}

export interface FormattedExpenseApplicationLine {
  description?: string;
  amount: number;
}

export interface FormattedExpenseApplicationApprover {
  step_id: number;
  user_id: number;
  status: string;
  is_force_action: boolean;
  resource_type: string;
}

export interface FormattedExpenseApplicationComment {
  comment: string;
  user_id: number;
  posted_at: string;
}

export interface FormattedExpenseApplicationFlowLog {
  action: string;
  user_id: number;
  updated_at: string;
}

export interface FormattedExpenseApplication {
  id: number;
  title: string;
  issue_date: string;
  total_amount: number;
  status: string;
  applicant_id: number;
  application_number: string;
  description?: string;
  section_id?: number;
  current_step_id?: number;
  current_round?: number;
  deal_id?: number;
  deal_status?: string;
  lines?: FormattedExpenseApplicationLine[];
  approvers?: FormattedExpenseApplicationApprover[];
  comments?: FormattedExpenseApplicationComment[];
  approval_flow_logs?: FormattedExpenseApplicationFlowLog[];
}

export interface FormattedReceipt {
  id: number;
  status: string;
  description?: string;
  mime_type?: string;
  issue_date?: string;
  origin?: string;
  created_at: string;
  file_src?: string;
  user_name?: string;
  qualified_invoice?: string;
}

export interface FormattedJournalEntry {
  date: string;
  txn_number: string;
  debit_account_item: string;
  debit_amount: number;
  credit_account_item: string;
  credit_amount: number;
  description?: string;
  partner?: string;
}

export interface FormattedTransfer {
  id: number;
  date: string;
  amount: number;
  from_walletable_id: number;
  from_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  to_walletable_id: number;
  to_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
  description?: string;
}

export interface ListSummary {
  total_count: number;
  total_income?: number;
  total_expense?: number;
  date_range?: string;
}

export interface FormattedListResponse<T> {
  summary: ListSummary;
  items: T[];
}

// Aggregation response types for server-side summarization

export interface PartnerAggregation {
  partner_id: number;
  partner_name: string;
  income: number;
  expense: number;
  count: number;
}

export interface MonthlyAggregation {
  month: string;
  income: number;
  expense: number;
  count: number;
}

export interface AccountItemAggregation {
  account_item_id: number;
  total: number;
  count: number;
}

export interface DealAggregation {
  total_count: number;
  total_income: number;
  total_expense: number;
  date_range?: string;
  truncated?: boolean;
  max_records_cap?: number;
  by_partner: PartnerAggregation[];
  by_month: MonthlyAggregation[];
  by_account_item: AccountItemAggregation[];
}

export interface InvoiceStatusAggregation {
  status: string;
  count: number;
  amount: number;
}

export interface InvoicePartnerAggregation {
  partner_id: number;
  partner_name: string;
  count: number;
  amount: number;
  unpaid: number;
}

export interface InvoiceSummaryAggregation {
  total_count: number;
  total_amount: number;
  unpaid_amount: number;
  overdue_count: number;
  date_range?: string;
  truncated?: boolean;
  max_records_cap?: number;
  by_status: InvoiceStatusAggregation[];
  by_partner: InvoicePartnerAggregation[];
}

// Multiyear trial balance types

export interface FreeeMultiyearTrialBalanceItem {
  account_item_id?: number;
  account_item_name: string;
  account_category_name?: string;
  hierarchy_level: number;
  closing_balance?: number;
  last_year_closing_balance?: number;
  two_years_before_closing_balance?: number;
  year_on_year?: number;
}

export interface FreeeMultiyearTrialBalance {
  company_id: number;
  fiscal_year: number;
  start_month?: number;
  end_month?: number;
  created_at: string;
  balances: FreeeMultiyearTrialBalanceItem[];
}

export interface MultiyearComparisonResult {
  report_type: 'pl' | 'bs';
  years: number;
  fiscal_year: number;
  start_month?: number;
  end_month?: number;
  items: MultiyearComparisonItem[];
}

export interface MultiyearComparisonItem {
  account_item_name: string;
  account_category_name?: string;
  hierarchy_level: number;
  current_year: number;
  last_year: number;
  two_years_before?: number;
  year_on_year_change: number | null;
  year_on_year_percentage: number | null;
}

// Period comparison types

export interface PeriodChange {
  amount: number;
  percentage: number | null;
}

export interface PeriodHighlight {
  item: string;
  change: string;
  significance: 'high' | 'medium' | 'low';
}

export interface PeriodComparisonResult {
  report_type: 'profit_loss' | 'balance_sheet';
  period1: {
    fiscal_year: number;
    start_month: number;
    end_month: number;
    metrics: Record<string, number>;
  };
  period2: {
    fiscal_year: number;
    start_month: number;
    end_month: number;
    metrics: Record<string, number>;
  };
  changes: Record<string, PeriodChange>;
  highlights: PeriodHighlight[];
}

// Monthly trends types

export interface MonthlyMetrics {
  month: number;
  metrics: Record<string, number>;
}

export interface MonthlyTrendsSummary {
  primary_metric: string;
  avg: number;
  max: { month: number; value: number };
  min: { month: number; value: number };
  trend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';
}

export interface MonthlyTrendsResult {
  fiscal_year: number;
  report_type: 'profit_loss' | 'balance_sheet';
  months: MonthlyMetrics[];
  summary: MonthlyTrendsSummary;
}

// Cash position types

export interface CashAccount {
  name: string;
  type: 'bank_account' | 'credit_card' | 'wallet';
  balance: number;
}

export interface CashPositionResult {
  total_cash: number;
  accounts: CashAccount[];
  receivables: {
    total: number;
    overdue: number;
    count: number;
  };
  payables: {
    total: number;
    overdue: number;
    count: number;
  };
  net_position: number;
}

// Item suggestion context types

export interface ItemSuggestionPastItem {
  id: number;
  name: string;
  unit_price: number;
  tax_code: number;
  used_count: number;
}

export interface ItemSuggestionAllItem {
  id: number;
  name: string;
  code?: string;
}

export interface ItemSuggestionResult {
  past_items: ItemSuggestionPastItem[];
  all_items: ItemSuggestionAllItem[];
  partner_history_summary: string;
}
