import type {
  FreeeDeal,
  FreeeInvoice,
  FreeePartner,
  FreeeAccountItem,
  FreeeSection,
  FreeeTag,
  FormattedDeal,
  FormattedDealDetail,
  FormattedInvoice,
  FormattedPartner,
  FormattedAccountItem,
  FormattedSection,
  FormattedTag,
  ListSummary,
  FormattedListResponse,
} from '../types/freee.js';

/**
 * Strips null, undefined, and empty array values from an object.
 */
function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === null || value === undefined) return undefined;
      if (Array.isArray(value) && value.length === 0) return undefined;
      return value;
    }),
  );
}

export class ResponseFormatter {
  // Deal formatting
  static formatDeal(deal: FreeeDeal): FormattedDeal {
    const detail: FormattedDealDetail[] = (deal.details ?? []).map((d) =>
      stripEmpty({
        account_item_id: d.account_item_id,
        amount: d.amount,
        tax_code: d.tax_code,
        description: d.description,
      }),
    ) as FormattedDealDetail[];

    return stripEmpty({
      id: deal.id,
      issue_date: deal.issue_date,
      type: deal.type,
      amount: deal.amount,
      partner_name: deal.partner_name,
      status: deal.status,
      due_date: deal.due_date,
      details: detail,
    }) as FormattedDeal;
  }

  static formatDeals(
    deals: FreeeDeal[],
    compact?: boolean,
  ): FormattedListResponse<FormattedDeal> {
    const summary = this.summarizeDeals(deals);
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: deals.map((d) => this.formatDeal(d)) };
  }

  private static summarizeDeals(deals: FreeeDeal[]): ListSummary {
    const sorted = [...deals].sort((a, b) =>
      a.issue_date.localeCompare(b.issue_date),
    );
    const summary: ListSummary = {
      total_count: deals.length,
      total_income: deals
        .filter((d) => d.type === 'income')
        .reduce((sum, d) => sum + d.amount, 0),
      total_expense: deals
        .filter((d) => d.type === 'expense')
        .reduce((sum, d) => sum + d.amount, 0),
    };
    if (sorted.length > 0) {
      summary.date_range = `${sorted[0].issue_date} to ${sorted[sorted.length - 1].issue_date}`;
    }
    return summary;
  }

  // Invoice formatting
  static formatInvoice(invoice: FreeeInvoice): FormattedInvoice {
    const lines = (invoice.invoice_lines ?? []).map((line) =>
      stripEmpty({
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        description: line.description,
      }),
    );

    return stripEmpty({
      id: invoice.id,
      issue_date: invoice.issue_date,
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount,
      partner_name: invoice.partner_name,
      invoice_status: invoice.invoice_status,
      payment_status: invoice.payment_status,
      title: invoice.title,
      due_date: invoice.due_date,
      invoice_lines: lines,
    }) as FormattedInvoice;
  }

  static formatInvoices(
    invoices: FreeeInvoice[],
    compact?: boolean,
  ): FormattedListResponse<FormattedInvoice> {
    const summary = this.summarizeInvoices(invoices);
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: invoices.map((i) => this.formatInvoice(i)) };
  }

  private static summarizeInvoices(invoices: FreeeInvoice[]): ListSummary {
    const sorted = [...invoices].sort((a, b) =>
      a.issue_date.localeCompare(b.issue_date),
    );
    const summary: ListSummary = {
      total_count: invoices.length,
      total_income: invoices.reduce((sum, i) => sum + i.total_amount, 0),
    };
    if (sorted.length > 0) {
      summary.date_range = `${sorted[0].issue_date} to ${sorted[sorted.length - 1].issue_date}`;
    }
    return summary;
  }

  // Partner formatting
  static formatPartner(partner: FreeePartner): FormattedPartner {
    return stripEmpty({
      id: partner.id,
      name: partner.name,
      shortcut1: partner.shortcut1,
      long_name: partner.long_name,
    }) as FormattedPartner;
  }

  static formatPartners(
    partners: FreeePartner[],
    compact?: boolean,
  ): FormattedListResponse<FormattedPartner> {
    const summary: ListSummary = { total_count: partners.length };
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: partners.map((p) => this.formatPartner(p)) };
  }

  // Account Item formatting
  static formatAccountItem(item: FreeeAccountItem): FormattedAccountItem {
    return stripEmpty({
      id: item.id,
      name: item.name,
      shortcut: item.shortcut,
      account_category: item.account_category,
      tax_code: item.tax_code,
    }) as FormattedAccountItem;
  }

  static formatAccountItems(
    items: FreeeAccountItem[],
    compact?: boolean,
  ): FormattedListResponse<FormattedAccountItem> {
    const summary: ListSummary = { total_count: items.length };
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: items.map((i) => this.formatAccountItem(i)) };
  }

  // Section formatting
  static formatSection(section: FreeeSection): FormattedSection {
    return stripEmpty({
      id: section.id,
      name: section.name,
      shortcut1: section.shortcut1,
    }) as FormattedSection;
  }

  static formatSections(
    sections: FreeeSection[],
    compact?: boolean,
  ): FormattedListResponse<FormattedSection> {
    const summary: ListSummary = { total_count: sections.length };
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: sections.map((s) => this.formatSection(s)) };
  }

  // Tag formatting
  static formatTag(tag: FreeeTag): FormattedTag {
    return stripEmpty({
      id: tag.id,
      name: tag.name,
      shortcut: tag.shortcut,
    }) as FormattedTag;
  }

  static formatTags(
    tags: FreeeTag[],
    compact?: boolean,
  ): FormattedListResponse<FormattedTag> {
    const summary: ListSummary = { total_count: tags.length };
    if (compact) {
      return { summary, items: [] };
    }
    return { summary, items: tags.map((t) => this.formatTag(t)) };
  }
}
