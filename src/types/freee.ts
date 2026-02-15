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

export interface FreeeSegmentTag {
  id: number;
  company_id: number;
  name: string;
  description?: string;
  shortcut1?: string;
  shortcut2?: string;
  available: boolean;
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

export interface FreeeApiError {
  status_code: number;
  errors: Array<{
    type: string;
    messages: string[];
  }>;
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
