import type {
  FreeeDeal,
  FreeeInvoice,
  FreeePartner,
  FreeeAccountItem,
  FreeeSection,
  FreeeTag,
  FreeeWalletable,
  FreeeManualJournal,
  FreeeTaxCode,
  FreeeWalletTransaction,
  FreeeTransfer,
  FormattedDeal,
  FormattedDealDetail,
  FormattedInvoice,
  FormattedPartner,
  FormattedAccountItem,
  FormattedSection,
  FormattedTag,
  FormattedTaxCode,
  FormattedWalletable,
  FormattedManualJournal,
  FormattedManualJournalDetail,
  FormattedWalletTransaction,
  FormattedTransfer,
  ListSummary,
  FormattedListResponse,
} from "../types/freee.js";

/**
 * Strips null and undefined values from an object, preserving empty arrays.
 */
function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === null || value === undefined) return undefined;
      if (Array.isArray(value) && value.length === 0) return value;
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
        section_id: d.section_id,
        tag_ids: d.tag_ids,
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
    const { income, expense } = deals.reduce(
      (acc, d) => {
        if (d.type === "income") acc.income += d.amount;
        else acc.expense += d.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
    const summary: ListSummary = {
      total_count: deals.length,
      total_income: income,
      total_expense: expense,
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

  // Walletable formatting
  static formatWalletable(walletable: FreeeWalletable): FormattedWalletable {
    return stripEmpty({
      id: walletable.id,
      name: walletable.name,
      type: walletable.type,
      last_balance: walletable.last_balance,
      walletable_balance: walletable.walletable_balance,
    }) as FormattedWalletable;
  }

  static formatWalletables(
    walletables: FreeeWalletable[],
  ): FormattedListResponse<FormattedWalletable> {
    const summary: ListSummary = { total_count: walletables.length };
    return {
      summary,
      items: walletables.map((w) => this.formatWalletable(w)),
    };
  }

  // Manual Journal formatting
  static formatManualJournal(
    journal: FreeeManualJournal,
  ): FormattedManualJournal {
    const details: FormattedManualJournalDetail[] = (journal.details ?? []).map(
      (d) =>
        stripEmpty({
          entry_side: d.entry_side,
          account_item_id: d.account_item_id,
          amount: d.amount,
          description: d.description,
          section_id: d.section_id,
          tag_ids: d.tag_ids,
          partner_name: d.partner_name,
        }),
    ) as FormattedManualJournalDetail[];

    return stripEmpty({
      id: journal.id,
      issue_date: journal.issue_date,
      adjustment: journal.adjustment,
      txn_number: journal.txn_number,
      details,
    }) as FormattedManualJournal;
  }

  static formatManualJournals(
    journals: FreeeManualJournal[],
  ): FormattedListResponse<FormattedManualJournal> {
    const summary = this.summarizeManualJournals(journals);
    return {
      summary,
      items: journals.map((j) => this.formatManualJournal(j)),
    };
  }

  private static summarizeManualJournals(
    journals: FreeeManualJournal[],
  ): ListSummary {
    const sorted = [...journals].sort((a, b) =>
      a.issue_date.localeCompare(b.issue_date),
    );
    const summary: ListSummary = { total_count: journals.length };
    if (sorted.length > 0) {
      summary.date_range = `${sorted[0].issue_date} to ${sorted[sorted.length - 1].issue_date}`;
    }
    return summary;
  }

  // Wallet Transaction formatting
  static formatWalletTransaction(
    txn: FreeeWalletTransaction,
  ): FormattedWalletTransaction {
    return stripEmpty({
      id: txn.id,
      date: txn.date,
      amount: txn.amount,
      due_amount: txn.due_amount,
      balance: txn.balance,
      entry_side: txn.entry_side,
      walletable_type: txn.walletable_type,
      walletable_id: txn.walletable_id,
      description: txn.description,
    }) as FormattedWalletTransaction;
  }

  static formatWalletTransactions(
    txns: FreeeWalletTransaction[],
  ): FormattedListResponse<FormattedWalletTransaction> {
    const summary = this.summarizeWalletTransactions(txns);
    return {
      summary,
      items: txns.map((t) => this.formatWalletTransaction(t)),
    };
  }

  private static summarizeWalletTransactions(
    txns: FreeeWalletTransaction[],
  ): ListSummary {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    const { income, expense } = txns.reduce(
      (acc, t) => {
        if (t.entry_side === "income") acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
    const summary: ListSummary = {
      total_count: txns.length,
      total_income: income,
      total_expense: expense,
    };
    if (sorted.length > 0) {
      summary.date_range = `${sorted[0].date} to ${sorted[sorted.length - 1].date}`;
    }
    return summary;
  }

  // Tax Code formatting
  static formatTaxCode(taxCode: FreeeTaxCode): FormattedTaxCode {
    return {
      code: taxCode.code,
      name: taxCode.name,
      name_ja: taxCode.name_ja,
    };
  }

  static formatTaxCodes(
    taxCodes: FreeeTaxCode[],
    compact?: boolean,
  ): FormattedListResponse<FormattedTaxCode> {
    const summary: ListSummary = { total_count: taxCodes.length };
    if (compact) {
      return { summary, items: [] };
    }
    return {
      summary,
      items: taxCodes.map((t) => this.formatTaxCode(t)),
    };
  }

  // Transfer formatting
  static formatTransfer(transfer: FreeeTransfer): FormattedTransfer {
    return stripEmpty({
      id: transfer.id,
      date: transfer.date,
      amount: transfer.amount,
      from_walletable_id: transfer.from_walletable_id,
      from_walletable_type: transfer.from_walletable_type,
      to_walletable_id: transfer.to_walletable_id,
      to_walletable_type: transfer.to_walletable_type,
      description: transfer.description,
    }) as FormattedTransfer;
  }

  static formatTransfers(
    transfers: FreeeTransfer[],
  ): FormattedListResponse<FormattedTransfer> {
    const summary = this.summarizeTransfers(transfers);
    return {
      summary,
      items: transfers.map((t) => this.formatTransfer(t)),
    };
  }

  private static summarizeTransfers(transfers: FreeeTransfer[]): ListSummary {
    const sorted = [...transfers].sort((a, b) => a.date.localeCompare(b.date));
    const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);
    const summary: ListSummary = {
      total_count: transfers.length,
      total_income: totalAmount,
    };
    if (sorted.length > 0) {
      summary.date_range = `${sorted[0].date} to ${sorted[sorted.length - 1].date}`;
    }
    return summary;
  }
}
