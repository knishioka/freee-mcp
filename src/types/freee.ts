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

export interface FreeeTrialBalance {
  company_id: number;
  fiscal_year: number;
  start_month: number;
  end_month: number;
  account_item_name: string;
  hierarchy_level: number;
  opening_balance: number;
  debit_amount: number;
  credit_amount: number;
  closing_balance: number;
  composition_ratio?: number;
}

export interface FreeeApiError {
  status_code: number;
  errors: Array<{
    type: string;
    messages: string[];
  }>;
}