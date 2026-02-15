import { ResponseFormatter } from '../../api/responseFormatter.js';
import type {
  FreeeDeal,
  FreeeDealDetail,
  FreeeInvoice,
  FreeeInvoiceLine,
  FreeePartner,
  FreeeAccountItem,
  FreeeSection,
  FreeeTag,
  FreeeTransfer,
  FreeeSegmentTag,
} from '../../types/freee.js';

// --- Test Data Factories ---

function makeDealDetail(overrides?: Partial<FreeeDealDetail>): FreeeDealDetail {
  return {
    id: 100,
    account_item_id: 1,
    tax_code: 21,
    amount: 10000,
    description: 'detail description',
    section_id: 5,
    tag_ids: [1, 2],
    ...overrides,
  };
}

function makeDeal(overrides?: Partial<FreeeDeal>): FreeeDeal {
  return {
    id: 1,
    company_id: 999,
    issue_date: '2024-01-15',
    due_date: '2024-02-15',
    amount: 10000,
    type: 'income',
    partner_id: 50,
    partner_name: 'Test Partner',
    ref_number: 'REF-001',
    status: 'settled',
    details: [makeDealDetail()],
    ...overrides,
  };
}

function makeInvoiceLine(
  overrides?: Partial<FreeeInvoiceLine>,
): FreeeInvoiceLine {
  return {
    id: 200,
    name: 'Service A',
    quantity: 2,
    unit_price: 5000,
    amount: 10000,
    description: 'line description',
    tax_code: 21,
    account_item_id: 1,
    ...overrides,
  };
}

function makeInvoice(overrides?: Partial<FreeeInvoice>): FreeeInvoice {
  return {
    id: 10,
    company_id: 999,
    issue_date: '2024-03-01',
    due_date: '2024-04-01',
    partner_id: 50,
    partner_name: 'Invoice Partner',
    invoice_number: 'INV-001',
    title: 'Monthly Invoice',
    total_amount: 50000,
    invoice_status: 'issue',
    payment_status: 'unsettled',
    invoice_lines: [makeInvoiceLine()],
    ...overrides,
  };
}

function makePartner(overrides?: Partial<FreeePartner>): FreeePartner {
  return {
    id: 20,
    company_id: 999,
    name: 'Partner Corp',
    shortcut1: 'PC',
    shortcut2: 'PCORP',
    long_name: 'Partner Corporation Ltd.',
    name_kana: 'パートナーコーポレーション',
    country_code: 'JP',
    available: true,
    ...overrides,
  };
}

function makeAccountItem(
  overrides?: Partial<FreeeAccountItem>,
): FreeeAccountItem {
  return {
    id: 30,
    company_id: 999,
    name: 'Sales',
    shortcut: 'SLS',
    account_category: 'income',
    tax_code: 21,
    available: true,
    ...overrides,
  };
}

function makeSection(overrides?: Partial<FreeeSection>): FreeeSection {
  return {
    id: 40,
    company_id: 999,
    name: 'Engineering',
    shortcut1: 'ENG',
    shortcut2: 'ENGR',
    available: true,
    ...overrides,
  };
}

function makeTag(overrides?: Partial<FreeeTag>): FreeeTag {
  return {
    id: 50,
    company_id: 999,
    name: 'Project Alpha',
    shortcut: 'PA',
    available: true,
    ...overrides,
  };
}

function makeTransfer(overrides?: Partial<FreeeTransfer>): FreeeTransfer {
  return {
    id: 60,
    company_id: 999,
    date: '2024-01-15',
    amount: 50000,
    from_walletable_id: 1,
    from_walletable_type: 'bank_account',
    to_walletable_id: 2,
    to_walletable_type: 'bank_account',
    description: 'Monthly transfer',
    ...overrides,
  };
}

function makeSegmentTag(overrides?: Partial<FreeeSegmentTag>): FreeeSegmentTag {
  return {
    id: 60,
    company_id: 999,
    name: 'Department A',
    description: 'Main department',
    shortcut1: 'DA',
    shortcut2: 'DEPTA',
    available: true,
    ...overrides,
  };
}

// --- Tests ---

describe('ResponseFormatter', () => {
  // =============================================
  // Deal Formatting
  // =============================================
  describe('formatDeal', () => {
    it('should preserve essential deal fields', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);

      expect(result.id).toBe(1);
      expect(result.issue_date).toBe('2024-01-15');
      expect(result.type).toBe('income');
      expect(result.amount).toBe(10000);
      expect(result.partner_name).toBe('Test Partner');
      expect(result.status).toBe('settled');
      expect(result.due_date).toBe('2024-02-15');
    });

    it('should strip company_id from deal', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip partner_id from deal', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);
      expect(result).not.toHaveProperty('partner_id');
    });

    it('should strip ref_number from deal', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);
      expect(result).not.toHaveProperty('ref_number');
    });

    it('should format deal details and strip non-essential detail fields', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);

      expect(result.details).toHaveLength(1);
      const detail = result.details![0];
      expect(detail.account_item_id).toBe(1);
      expect(detail.amount).toBe(10000);
      expect(detail.tax_code).toBe(21);
      expect(detail.description).toBe('detail description');
    });

    it('should preserve section_id and tag_ids in deal details', () => {
      const deal = makeDeal();
      const result = ResponseFormatter.formatDeal(deal);

      const detail = result.details![0];
      expect(detail).not.toHaveProperty('id');
      expect(detail.section_id).toBe(5);
      expect(detail.tag_ids).toEqual([1, 2]);
    });

    it('should strip null/undefined optional fields', () => {
      const deal = makeDeal({
        due_date: undefined,
        partner_name: undefined,
        partner_id: undefined,
      });
      const result = ResponseFormatter.formatDeal(deal);

      expect(result).not.toHaveProperty('due_date');
      expect(result).not.toHaveProperty('partner_name');
    });

    it('should strip detail description when null', () => {
      const deal = makeDeal({
        details: [makeDealDetail({ description: undefined })],
      });
      const result = ResponseFormatter.formatDeal(deal);
      expect(result.details![0]).not.toHaveProperty('description');
    });

    it('should handle deal with empty details array', () => {
      const deal = makeDeal({ details: [] });
      const result = ResponseFormatter.formatDeal(deal);
      // Empty arrays are preserved by stripEmpty
      expect(result.details).toEqual([]);
    });

    it('should handle deal with undefined details', () => {
      const deal = makeDeal();
      // Force undefined details to simulate API quirks
      (deal as unknown as Record<string, unknown>).details = undefined;
      const result = ResponseFormatter.formatDeal(deal);
      // details defaults to [] via ?? [], empty arrays are preserved
      expect(result.details).toEqual([]);
    });
  });

  describe('formatDeals', () => {
    it('should return formatted items with summary', () => {
      const deals = [
        makeDeal({
          id: 1,
          type: 'income',
          amount: 10000,
          issue_date: '2024-01-01',
        }),
        makeDeal({
          id: 2,
          type: 'expense',
          amount: 3000,
          issue_date: '2024-01-15',
        }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
      expect(result.items[0].id).toBe(1);
      expect(result.items[1].id).toBe(2);
    });

    it('should calculate total_income in summary (only income type deals)', () => {
      const deals = [
        makeDeal({ type: 'income', amount: 10000, issue_date: '2024-01-01' }),
        makeDeal({ type: 'income', amount: 20000, issue_date: '2024-02-01' }),
        makeDeal({ type: 'expense', amount: 5000, issue_date: '2024-03-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.total_income).toBe(30000);
    });

    it('should calculate total_expense in summary (only expense type deals)', () => {
      const deals = [
        makeDeal({ type: 'income', amount: 10000, issue_date: '2024-01-01' }),
        makeDeal({ type: 'expense', amount: 5000, issue_date: '2024-02-01' }),
        makeDeal({ type: 'expense', amount: 8000, issue_date: '2024-03-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.total_expense).toBe(13000);
    });

    it('should calculate date_range from earliest to latest issue_date', () => {
      const deals = [
        makeDeal({ issue_date: '2024-03-15' }),
        makeDeal({ issue_date: '2024-01-01' }),
        makeDeal({ issue_date: '2024-06-30' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.date_range).toBe('2024-01-01 to 2024-06-30');
    });

    it('should set date_range for a single deal', () => {
      const deals = [makeDeal({ issue_date: '2024-05-15' })];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.date_range).toBe('2024-05-15 to 2024-05-15');
    });

    it('should return empty items array when compact=true', () => {
      const deals = [
        makeDeal({ type: 'income', amount: 10000, issue_date: '2024-01-01' }),
        makeDeal({ type: 'expense', amount: 5000, issue_date: '2024-02-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
      expect(result.summary.total_income).toBe(10000);
      expect(result.summary.total_expense).toBe(5000);
      expect(result.summary.date_range).toBe('2024-01-01 to 2024-02-01');
    });

    it('should return full items when compact=false', () => {
      const deals = [makeDeal()];
      const result = ResponseFormatter.formatDeals(deals, false);

      expect(result.items).toHaveLength(1);
    });

    it('should handle empty deals array', () => {
      const result = ResponseFormatter.formatDeals([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.summary.total_income).toBe(0);
      expect(result.summary.total_expense).toBe(0);
      expect(result.summary.date_range).toBeUndefined();
      expect(result.items).toEqual([]);
    });

    it('should have zero total_income when no income deals exist', () => {
      const deals = [
        makeDeal({ type: 'expense', amount: 5000, issue_date: '2024-01-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.total_income).toBe(0);
    });

    it('should have zero total_expense when no expense deals exist', () => {
      const deals = [
        makeDeal({ type: 'income', amount: 10000, issue_date: '2024-01-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.total_expense).toBe(0);
    });
  });

  // =============================================
  // Invoice Formatting
  // =============================================
  describe('formatInvoice', () => {
    it('should preserve essential invoice fields', () => {
      const invoice = makeInvoice();
      const result = ResponseFormatter.formatInvoice(invoice);

      expect(result.id).toBe(10);
      expect(result.issue_date).toBe('2024-03-01');
      expect(result.invoice_number).toBe('INV-001');
      expect(result.total_amount).toBe(50000);
      expect(result.partner_name).toBe('Invoice Partner');
      expect(result.invoice_status).toBe('issue');
      expect(result.payment_status).toBe('unsettled');
      expect(result.title).toBe('Monthly Invoice');
      expect(result.due_date).toBe('2024-04-01');
    });

    it('should strip company_id from invoice', () => {
      const invoice = makeInvoice();
      const result = ResponseFormatter.formatInvoice(invoice);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip partner_id from invoice', () => {
      const invoice = makeInvoice();
      const result = ResponseFormatter.formatInvoice(invoice);
      expect(result).not.toHaveProperty('partner_id');
    });

    it('should format invoice lines and strip non-essential line fields', () => {
      const invoice = makeInvoice();
      const result = ResponseFormatter.formatInvoice(invoice);

      expect(result.invoice_lines).toHaveLength(1);
      const line = result.invoice_lines![0];
      expect(line.name).toBe('Service A');
      expect(line.quantity).toBe(2);
      expect(line.unit_price).toBe(5000);
      expect(line.amount).toBe(10000);
      expect(line.description).toBe('line description');
    });

    it('should strip id, tax_code, account_item_id from invoice lines', () => {
      const invoice = makeInvoice();
      const result = ResponseFormatter.formatInvoice(invoice);

      const line = result.invoice_lines![0];
      expect(line).not.toHaveProperty('id');
      expect(line).not.toHaveProperty('tax_code');
      expect(line).not.toHaveProperty('account_item_id');
    });

    it('should strip null/undefined optional fields from invoice', () => {
      const invoice = makeInvoice({
        due_date: undefined,
        partner_name: undefined,
        title: undefined,
        payment_status: undefined,
      });
      const result = ResponseFormatter.formatInvoice(invoice);

      expect(result).not.toHaveProperty('due_date');
      expect(result).not.toHaveProperty('partner_name');
      expect(result).not.toHaveProperty('title');
      expect(result).not.toHaveProperty('payment_status');
    });

    it('should strip line description when null/undefined', () => {
      const invoice = makeInvoice({
        invoice_lines: [
          makeInvoiceLine({ description: undefined, amount: undefined }),
        ],
      });
      const result = ResponseFormatter.formatInvoice(invoice);

      const line = result.invoice_lines![0];
      expect(line).not.toHaveProperty('description');
      expect(line).not.toHaveProperty('amount');
    });

    it('should handle invoice with empty lines array', () => {
      const invoice = makeInvoice({ invoice_lines: [] });
      const result = ResponseFormatter.formatInvoice(invoice);
      // Empty arrays are preserved by stripEmpty
      expect(result.invoice_lines).toEqual([]);
    });
  });

  describe('formatInvoices', () => {
    it('should return formatted items with summary', () => {
      const invoices = [
        makeInvoice({ id: 10, total_amount: 50000, issue_date: '2024-03-01' }),
        makeInvoice({ id: 11, total_amount: 30000, issue_date: '2024-04-01' }),
      ];
      const result = ResponseFormatter.formatInvoices(invoices);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should calculate total_income as sum of total_amount', () => {
      const invoices = [
        makeInvoice({ total_amount: 50000, issue_date: '2024-01-01' }),
        makeInvoice({ total_amount: 30000, issue_date: '2024-02-01' }),
        makeInvoice({ total_amount: 20000, issue_date: '2024-03-01' }),
      ];
      const result = ResponseFormatter.formatInvoices(invoices);

      expect(result.summary.total_income).toBe(100000);
    });

    it('should not include total_expense in invoice summary', () => {
      const invoices = [makeInvoice({ issue_date: '2024-01-01' })];
      const result = ResponseFormatter.formatInvoices(invoices);

      expect(result.summary.total_expense).toBeUndefined();
    });

    it('should calculate date_range from earliest to latest issue_date', () => {
      const invoices = [
        makeInvoice({ issue_date: '2024-06-01' }),
        makeInvoice({ issue_date: '2024-01-15' }),
        makeInvoice({ issue_date: '2024-09-30' }),
      ];
      const result = ResponseFormatter.formatInvoices(invoices);

      expect(result.summary.date_range).toBe('2024-01-15 to 2024-09-30');
    });

    it('should return empty items array when compact=true', () => {
      const invoices = [
        makeInvoice({ total_amount: 50000, issue_date: '2024-03-01' }),
        makeInvoice({ total_amount: 30000, issue_date: '2024-04-01' }),
      ];
      const result = ResponseFormatter.formatInvoices(invoices, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
      expect(result.summary.total_income).toBe(80000);
      expect(result.summary.date_range).toBe('2024-03-01 to 2024-04-01');
    });

    it('should handle empty invoices array', () => {
      const result = ResponseFormatter.formatInvoices([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.summary.total_income).toBe(0);
      expect(result.summary.date_range).toBeUndefined();
      expect(result.items).toEqual([]);
    });
  });

  // =============================================
  // Partner Formatting
  // =============================================
  describe('formatPartner', () => {
    it('should preserve essential partner fields', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);

      expect(result.id).toBe(20);
      expect(result.name).toBe('Partner Corp');
      expect(result.shortcut1).toBe('PC');
      expect(result.long_name).toBe('Partner Corporation Ltd.');
    });

    it('should strip company_id from partner', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip available from partner', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);
      expect(result).not.toHaveProperty('available');
    });

    it('should strip shortcut2 from partner', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);
      expect(result).not.toHaveProperty('shortcut2');
    });

    it('should strip name_kana from partner', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);
      expect(result).not.toHaveProperty('name_kana');
    });

    it('should strip country_code from partner', () => {
      const partner = makePartner();
      const result = ResponseFormatter.formatPartner(partner);
      expect(result).not.toHaveProperty('country_code');
    });

    it('should strip null/undefined optional fields', () => {
      const partner = makePartner({
        shortcut1: undefined,
        long_name: undefined,
      });
      const result = ResponseFormatter.formatPartner(partner);

      expect(result).not.toHaveProperty('shortcut1');
      expect(result).not.toHaveProperty('long_name');
    });
  });

  describe('formatPartners', () => {
    it('should return formatted items with summary', () => {
      const partners = [
        makePartner({ id: 20, name: 'A Corp' }),
        makePartner({ id: 21, name: 'B Corp' }),
      ];
      const result = ResponseFormatter.formatPartners(partners);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should have no income/expense/date_range in partner summary', () => {
      const partners = [makePartner()];
      const result = ResponseFormatter.formatPartners(partners);

      expect(result.summary.total_income).toBeUndefined();
      expect(result.summary.total_expense).toBeUndefined();
      expect(result.summary.date_range).toBeUndefined();
    });

    it('should return empty items array when compact=true', () => {
      const partners = [makePartner(), makePartner()];
      const result = ResponseFormatter.formatPartners(partners, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
    });

    it('should handle empty partners array', () => {
      const result = ResponseFormatter.formatPartners([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // =============================================
  // Account Item Formatting
  // =============================================
  describe('formatAccountItem', () => {
    it('should preserve essential account item fields', () => {
      const item = makeAccountItem();
      const result = ResponseFormatter.formatAccountItem(item);

      expect(result.id).toBe(30);
      expect(result.name).toBe('Sales');
      expect(result.shortcut).toBe('SLS');
      expect(result.account_category).toBe('income');
      expect(result.tax_code).toBe(21);
    });

    it('should strip company_id from account item', () => {
      const item = makeAccountItem();
      const result = ResponseFormatter.formatAccountItem(item);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip available from account item', () => {
      const item = makeAccountItem();
      const result = ResponseFormatter.formatAccountItem(item);
      expect(result).not.toHaveProperty('available');
    });

    it('should strip null/undefined optional fields', () => {
      const item = makeAccountItem({
        shortcut: undefined,
        tax_code: undefined,
      });
      const result = ResponseFormatter.formatAccountItem(item);

      expect(result).not.toHaveProperty('shortcut');
      expect(result).not.toHaveProperty('tax_code');
    });
  });

  describe('formatAccountItems', () => {
    it('should return formatted items with summary', () => {
      const items = [
        makeAccountItem({ id: 30, name: 'Sales' }),
        makeAccountItem({ id: 31, name: 'Cost of Sales' }),
      ];
      const result = ResponseFormatter.formatAccountItems(items);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should return empty items array when compact=true', () => {
      const items = [makeAccountItem(), makeAccountItem()];
      const result = ResponseFormatter.formatAccountItems(items, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
    });

    it('should handle empty account items array', () => {
      const result = ResponseFormatter.formatAccountItems([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // =============================================
  // Section Formatting
  // =============================================
  describe('formatSection', () => {
    it('should preserve essential section fields', () => {
      const section = makeSection();
      const result = ResponseFormatter.formatSection(section);

      expect(result.id).toBe(40);
      expect(result.name).toBe('Engineering');
      expect(result.shortcut1).toBe('ENG');
    });

    it('should strip company_id from section', () => {
      const section = makeSection();
      const result = ResponseFormatter.formatSection(section);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip available from section', () => {
      const section = makeSection();
      const result = ResponseFormatter.formatSection(section);
      expect(result).not.toHaveProperty('available');
    });

    it('should strip shortcut2 from section', () => {
      const section = makeSection();
      const result = ResponseFormatter.formatSection(section);
      expect(result).not.toHaveProperty('shortcut2');
    });

    it('should strip null/undefined optional fields', () => {
      const section = makeSection({ shortcut1: undefined });
      const result = ResponseFormatter.formatSection(section);
      expect(result).not.toHaveProperty('shortcut1');
    });
  });

  describe('formatSections', () => {
    it('should return formatted items with summary', () => {
      const sections = [
        makeSection({ id: 40, name: 'Engineering' }),
        makeSection({ id: 41, name: 'Sales' }),
      ];
      const result = ResponseFormatter.formatSections(sections);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should return empty items array when compact=true', () => {
      const sections = [makeSection(), makeSection()];
      const result = ResponseFormatter.formatSections(sections, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
    });

    it('should handle empty sections array', () => {
      const result = ResponseFormatter.formatSections([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // =============================================
  // Tag Formatting
  // =============================================
  describe('formatTag', () => {
    it('should preserve essential tag fields', () => {
      const tag = makeTag();
      const result = ResponseFormatter.formatTag(tag);

      expect(result.id).toBe(50);
      expect(result.name).toBe('Project Alpha');
      expect(result.shortcut).toBe('PA');
    });

    it('should strip company_id from tag', () => {
      const tag = makeTag();
      const result = ResponseFormatter.formatTag(tag);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip available from tag', () => {
      const tag = makeTag();
      const result = ResponseFormatter.formatTag(tag);
      expect(result).not.toHaveProperty('available');
    });

    it('should strip null/undefined optional fields', () => {
      const tag = makeTag({ shortcut: undefined });
      const result = ResponseFormatter.formatTag(tag);
      expect(result).not.toHaveProperty('shortcut');
    });
  });

  describe('formatTags', () => {
    it('should return formatted items with summary', () => {
      const tags = [
        makeTag({ id: 50, name: 'Project Alpha' }),
        makeTag({ id: 51, name: 'Project Beta' }),
      ];
      const result = ResponseFormatter.formatTags(tags);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should return empty items array when compact=true', () => {
      const tags = [makeTag(), makeTag()];
      const result = ResponseFormatter.formatTags(tags, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
    });

    it('should handle empty tags array', () => {
      const result = ResponseFormatter.formatTags([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // =============================================
  // Segment Tag Formatting
  // =============================================
  describe('formatSegmentTag', () => {
    it('should preserve essential segment tag fields', () => {
      const tag = makeSegmentTag();
      const result = ResponseFormatter.formatSegmentTag(tag);

      expect(result.id).toBe(60);
      expect(result.name).toBe('Department A');
      expect(result.description).toBe('Main department');
      expect(result.shortcut1).toBe('DA');
    });

    it('should strip company_id from segment tag', () => {
      const tag = makeSegmentTag();
      const result = ResponseFormatter.formatSegmentTag(tag);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip available from segment tag', () => {
      const tag = makeSegmentTag();
      const result = ResponseFormatter.formatSegmentTag(tag);
      expect(result).not.toHaveProperty('available');
    });

    it('should strip shortcut2 from segment tag', () => {
      const tag = makeSegmentTag();
      const result = ResponseFormatter.formatSegmentTag(tag);
      expect(result).not.toHaveProperty('shortcut2');
    });

    it('should strip null/undefined optional fields', () => {
      const tag = makeSegmentTag({
        description: undefined,
        shortcut1: undefined,
      });
      const result = ResponseFormatter.formatSegmentTag(tag);

      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('shortcut1');
    });
  });

  describe('formatSegmentTags', () => {
    it('should return formatted items with summary', () => {
      const tags = [
        makeSegmentTag({ id: 60, name: 'Department A' }),
        makeSegmentTag({ id: 61, name: 'Department B' }),
      ];
      const result = ResponseFormatter.formatSegmentTags(tags);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should return empty items array when compact=true', () => {
      const tags = [makeSegmentTag(), makeSegmentTag()];
      const result = ResponseFormatter.formatSegmentTags(tags, true);

      expect(result.items).toEqual([]);
      expect(result.summary.total_count).toBe(2);
    });

    it('should handle empty segment tags array', () => {
      const result = ResponseFormatter.formatSegmentTags([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should have no income/expense/date_range in segment tag summary', () => {
      const tags = [makeSegmentTag()];
      const result = ResponseFormatter.formatSegmentTags(tags);

      expect(result.summary.total_income).toBeUndefined();
      expect(result.summary.total_expense).toBeUndefined();
      expect(result.summary.date_range).toBeUndefined();
    });
  });

  // =============================================
  // Size Reduction Verification
  // =============================================
  describe('size reduction', () => {
    it('should produce smaller output than raw deal data', () => {
      const deal = makeDeal();
      const rawSize = JSON.stringify(deal).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatDeal(deal),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw invoice data', () => {
      const invoice = makeInvoice();
      const rawSize = JSON.stringify(invoice).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatInvoice(invoice),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw partner data', () => {
      const partner = makePartner();
      const rawSize = JSON.stringify(partner).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatPartner(partner),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw account item data', () => {
      const item = makeAccountItem();
      const rawSize = JSON.stringify(item).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatAccountItem(item),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw section data', () => {
      const section = makeSection();
      const rawSize = JSON.stringify(section).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatSection(section),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw tag data', () => {
      const tag = makeTag();
      const rawSize = JSON.stringify(tag).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatTag(tag),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce smaller output than raw segment tag data', () => {
      const tag = makeSegmentTag();
      const rawSize = JSON.stringify(tag).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatSegmentTag(tag),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });

    it('should produce significantly smaller output for deal lists in compact mode', () => {
      const deals = Array.from({ length: 10 }, (_, i) =>
        makeDeal({ id: i + 1, issue_date: `2024-0${(i % 9) + 1}-01` }),
      );
      const rawSize = JSON.stringify(deals).length;
      const compactResult = ResponseFormatter.formatDeals(deals, true);
      const compactSize = JSON.stringify(compactResult).length;

      expect(compactSize).toBeLessThan(rawSize);
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe('edge cases', () => {
    it('should handle deal with multiple details', () => {
      const deal = makeDeal({
        details: [
          makeDealDetail({ account_item_id: 1, amount: 5000 }),
          makeDealDetail({ account_item_id: 2, amount: 3000 }),
          makeDealDetail({
            account_item_id: 3,
            amount: 2000,
            description: undefined,
          }),
        ],
      });
      const result = ResponseFormatter.formatDeal(deal);

      expect(result.details).toHaveLength(3);
      expect(result.details![0].amount).toBe(5000);
      expect(result.details![1].amount).toBe(3000);
      expect(result.details![2].amount).toBe(2000);
      expect(result.details![2]).not.toHaveProperty('description');
    });

    it('should handle invoice with multiple lines', () => {
      const invoice = makeInvoice({
        invoice_lines: [
          makeInvoiceLine({
            name: 'Service A',
            quantity: 1,
            unit_price: 10000,
          }),
          makeInvoiceLine({ name: 'Service B', quantity: 3, unit_price: 5000 }),
        ],
      });
      const result = ResponseFormatter.formatInvoice(invoice);

      expect(result.invoice_lines).toHaveLength(2);
      expect(result.invoice_lines![0].name).toBe('Service A');
      expect(result.invoice_lines![1].name).toBe('Service B');
    });

    it('should handle deals with same issue_date for date_range', () => {
      const deals = [
        makeDeal({ issue_date: '2024-06-15' }),
        makeDeal({ issue_date: '2024-06-15' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.date_range).toBe('2024-06-15 to 2024-06-15');
    });

    it('should correctly sort dates as strings for date_range', () => {
      const deals = [
        makeDeal({ issue_date: '2024-12-01' }),
        makeDeal({ issue_date: '2024-02-01' }),
        makeDeal({ issue_date: '2024-07-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.date_range).toBe('2024-02-01 to 2024-12-01');
    });

    it('should handle zero amounts in deals', () => {
      const deals = [
        makeDeal({ type: 'income', amount: 0, issue_date: '2024-01-01' }),
      ];
      const result = ResponseFormatter.formatDeals(deals);

      expect(result.summary.total_income).toBe(0);
      expect(result.items[0].amount).toBe(0);
    });

    it('should handle zero total_amount in invoices', () => {
      const invoices = [
        makeInvoice({ total_amount: 0, issue_date: '2024-01-01' }),
      ];
      const result = ResponseFormatter.formatInvoices(invoices);

      expect(result.summary.total_income).toBe(0);
    });
  });

  // =============================================
  // Transfer Formatting
  // =============================================
  describe('formatTransfer', () => {
    it('should preserve essential transfer fields', () => {
      const transfer = makeTransfer();
      const result = ResponseFormatter.formatTransfer(transfer);

      expect(result.id).toBe(60);
      expect(result.date).toBe('2024-01-15');
      expect(result.amount).toBe(50000);
      expect(result.from_walletable_id).toBe(1);
      expect(result.from_walletable_type).toBe('bank_account');
      expect(result.to_walletable_id).toBe(2);
      expect(result.to_walletable_type).toBe('bank_account');
      expect(result.description).toBe('Monthly transfer');
    });

    it('should strip company_id from transfer', () => {
      const transfer = makeTransfer();
      const result = ResponseFormatter.formatTransfer(transfer);
      expect(result).not.toHaveProperty('company_id');
    });

    it('should strip null/undefined optional fields', () => {
      const transfer = makeTransfer({ description: undefined });
      const result = ResponseFormatter.formatTransfer(transfer);

      expect(result).not.toHaveProperty('description');
    });

    it('should handle transfer with credit_card walletable type', () => {
      const transfer = makeTransfer({
        from_walletable_type: 'credit_card',
        to_walletable_type: 'wallet',
      });
      const result = ResponseFormatter.formatTransfer(transfer);

      expect(result.from_walletable_type).toBe('credit_card');
      expect(result.to_walletable_type).toBe('wallet');
    });
  });

  describe('formatTransfers', () => {
    it('should return formatted items with summary', () => {
      const transfers = [
        makeTransfer({ id: 60, amount: 50000, date: '2024-01-15' }),
        makeTransfer({ id: 61, amount: 30000, date: '2024-02-15' }),
      ];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.items).toHaveLength(2);
      expect(result.summary.total_count).toBe(2);
    });

    it('should calculate total_income as sum of all transfer amounts', () => {
      const transfers = [
        makeTransfer({ amount: 50000, date: '2024-01-01' }),
        makeTransfer({ amount: 30000, date: '2024-02-01' }),
        makeTransfer({ amount: 20000, date: '2024-03-01' }),
      ];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.total_income).toBe(100000);
    });

    it('should not include total_expense in transfer summary', () => {
      const transfers = [makeTransfer({ date: '2024-01-01' })];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.total_expense).toBeUndefined();
    });

    it('should calculate date_range from earliest to latest date', () => {
      const transfers = [
        makeTransfer({ date: '2024-06-01' }),
        makeTransfer({ date: '2024-01-15' }),
        makeTransfer({ date: '2024-09-30' }),
      ];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.date_range).toBe('2024-01-15 to 2024-09-30');
    });

    it('should set date_range for a single transfer', () => {
      const transfers = [makeTransfer({ date: '2024-05-15' })];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.date_range).toBe('2024-05-15 to 2024-05-15');
    });

    it('should handle empty transfers array', () => {
      const result = ResponseFormatter.formatTransfers([]);

      expect(result.summary.total_count).toBe(0);
      expect(result.summary.total_income).toBe(0);
      expect(result.summary.date_range).toBeUndefined();
      expect(result.items).toEqual([]);
    });

    it('should handle zero amount transfers', () => {
      const transfers = [makeTransfer({ amount: 0, date: '2024-01-01' })];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.total_income).toBe(0);
      expect(result.items[0].amount).toBe(0);
    });

    it('should strip company_id from all formatted transfer items', () => {
      const transfers = [makeTransfer({ id: 60 }), makeTransfer({ id: 61 })];
      const result = ResponseFormatter.formatTransfers(transfers);

      result.items.forEach((item) => {
        expect(item).not.toHaveProperty('company_id');
      });
    });

    it('should handle transfers with same date for date_range', () => {
      const transfers = [
        makeTransfer({ date: '2024-06-15' }),
        makeTransfer({ date: '2024-06-15' }),
      ];
      const result = ResponseFormatter.formatTransfers(transfers);

      expect(result.summary.date_range).toBe('2024-06-15 to 2024-06-15');
    });
  });

  // =============================================
  // Transfer Size Reduction
  // =============================================
  describe('transfer size reduction', () => {
    it('should produce smaller output than raw transfer data', () => {
      const transfer = makeTransfer();
      const rawSize = JSON.stringify(transfer).length;
      const formattedSize = JSON.stringify(
        ResponseFormatter.formatTransfer(transfer),
      ).length;

      expect(formattedSize).toBeLessThan(rawSize);
    });
  });
});
