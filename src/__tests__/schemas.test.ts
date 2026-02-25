import { z } from 'zod';
import {
  GetDealsSchema,
  CreateDealSchema,
  UpdateDealSchema,
  CreateDealPaymentSchema,
  CreateTransferSchema,
  GetInvoicesSchema,
  CreateInvoiceSchema,
  GetPartnersSchema,
  GetSegmentTagsSchema,
  GetManualJournalsSchema,
  CreateManualJournalSchema,
  GetWalletTxnsSchema,
  GetTransfersSchema,
  GetExpenseApplicationsSchema,
  GetReceiptsSchema,
  GetJournalsSchema,
  SearchDealsSchema,
  SummarizeInvoicesSchema,
} from '../schemas.js';

/**
 * Tests for Issue #111: date format, offset, and amount validations in schemas.
 *
 * Acceptance criteria:
 * - dateField rejects invalid formats: "not-a-date", "2024/01/01", "2024-13-45", "", "2024-1-1"
 * - dateField accepts valid format: "2024-01-15"
 * - optionalDateField allows undefined
 * - offset fields reject negative numbers (-1)
 * - offset fields accept 0 and positive numbers
 * - amount fields reject 0 and negative numbers
 * - amount fields accept 1 and positive numbers
 */

// ── dateField validation ───────────────────────────────────────────────────

describe('dateField validation', () => {
  // Use CreateDealSchema.issueDate as a representative required dateField
  const schema = z.object({ issueDate: CreateDealSchema.issueDate });

  it('should accept valid YYYY-MM-DD date "2024-01-15"', () => {
    const result = schema.safeParse({ issueDate: '2024-01-15' });
    expect(result.success).toBe(true);
  });

  it('should accept valid YYYY-MM-DD date "2000-12-31"', () => {
    const result = schema.safeParse({ issueDate: '2000-12-31' });
    expect(result.success).toBe(true);
  });

  it('should reject non-date string "not-a-date"', () => {
    const result = schema.safeParse({ issueDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('should reject slash-separated date "2024/01/01"', () => {
    const result = schema.safeParse({ issueDate: '2024/01/01' });
    expect(result.success).toBe(false);
  });

  it('should reject semantically invalid date "2024-13-45"', () => {
    const result = schema.safeParse({ issueDate: '2024-13-45' });
    expect(result.success).toBe(false);
  });

  it('should reject impossible date "2024-02-30"', () => {
    const result = schema.safeParse({ issueDate: '2024-02-30' });
    expect(result.success).toBe(false);
  });

  it('should accept valid leap year date "2024-02-29"', () => {
    const result = schema.safeParse({ issueDate: '2024-02-29' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid leap year date "2023-02-29"', () => {
    const result = schema.safeParse({ issueDate: '2023-02-29' });
    expect(result.success).toBe(false);
  });

  it('should reject empty string ""', () => {
    const result = schema.safeParse({ issueDate: '' });
    expect(result.success).toBe(false);
  });

  it('should reject single-digit month/day "2024-1-1"', () => {
    const result = schema.safeParse({ issueDate: '2024-1-1' });
    expect(result.success).toBe(false);
  });

  it('should reject undefined for required dateField', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should include descriptive error message on failure', () => {
    const result = schema.safeParse({ issueDate: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('YYYY-MM-DD'))).toBe(true);
    }
  });
});

// Test dateField across multiple schemas to verify consistency
describe('dateField applied to multiple schemas', () => {
  const dateFieldCases: {
    schemaName: string;
    schema: Record<string, z.ZodTypeAny>;
    field: string;
  }[] = [
    {
      schemaName: 'CreateDealSchema',
      schema: CreateDealSchema,
      field: 'issueDate',
    },
    {
      schemaName: 'CreateDealPaymentSchema',
      schema: CreateDealPaymentSchema,
      field: 'date',
    },
    {
      schemaName: 'CreateTransferSchema',
      schema: CreateTransferSchema,
      field: 'date',
    },
    {
      schemaName: 'CreateInvoiceSchema',
      schema: CreateInvoiceSchema,
      field: 'issueDate',
    },
    {
      schemaName: 'CreateManualJournalSchema',
      schema: CreateManualJournalSchema,
      field: 'issueDate',
    },
    {
      schemaName: 'GetJournalsSchema',
      schema: GetJournalsSchema,
      field: 'startDate',
    },
    {
      schemaName: 'GetJournalsSchema',
      schema: GetJournalsSchema,
      field: 'endDate',
    },
  ];

  describe.each(dateFieldCases)('$schemaName.$field', ({ schema, field }) => {
    const wrapped = z.object({
      [field]: (schema as Record<string, z.ZodTypeAny>)[field],
    });

    it('should reject invalid format "2024/01/01"', () => {
      const result = wrapped.safeParse({ [field]: '2024/01/01' });
      expect(result.success).toBe(false);
    });

    it('should accept valid format "2024-01-15"', () => {
      const result = wrapped.safeParse({ [field]: '2024-01-15' });
      expect(result.success).toBe(true);
    });

    it('should reject semantically invalid date "2024-13-45"', () => {
      const result = wrapped.safeParse({ [field]: '2024-13-45' });
      expect(result.success).toBe(false);
    });
  });
});

// ── optionalDateField validation ───────────────────────────────────────────

describe('optionalDateField validation', () => {
  // Use GetDealsSchema.startIssueDate as a representative optionalDateField
  const schema = z.object({ startIssueDate: GetDealsSchema.startIssueDate });

  it('should accept valid YYYY-MM-DD date "2024-01-15"', () => {
    const result = schema.safeParse({ startIssueDate: '2024-01-15' });
    expect(result.success).toBe(true);
  });

  it('should allow undefined (field omitted)', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should allow explicit undefined', () => {
    const result = schema.safeParse({ startIssueDate: undefined });
    expect(result.success).toBe(true);
  });

  it('should reject invalid format "not-a-date"', () => {
    const result = schema.safeParse({ startIssueDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('should reject slash-separated date "2024/01/01"', () => {
    const result = schema.safeParse({ startIssueDate: '2024/01/01' });
    expect(result.success).toBe(false);
  });

  it('should reject empty string ""', () => {
    const result = schema.safeParse({ startIssueDate: '' });
    expect(result.success).toBe(false);
  });

  it('should reject single-digit month/day "2024-1-1"', () => {
    const result = schema.safeParse({ startIssueDate: '2024-1-1' });
    expect(result.success).toBe(false);
  });
});

// Test optionalDateField across multiple schemas
describe('optionalDateField applied to multiple schemas', () => {
  const optionalDateFieldCases: {
    schemaName: string;
    schema: Record<string, z.ZodTypeAny>;
    field: string;
  }[] = [
    {
      schemaName: 'GetDealsSchema',
      schema: GetDealsSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'GetDealsSchema',
      schema: GetDealsSchema,
      field: 'endIssueDate',
    },
    {
      schemaName: 'CreateDealSchema',
      schema: CreateDealSchema,
      field: 'dueDate',
    },
    {
      schemaName: 'UpdateDealSchema',
      schema: UpdateDealSchema,
      field: 'issueDate',
    },
    {
      schemaName: 'GetInvoicesSchema',
      schema: GetInvoicesSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'GetInvoicesSchema',
      schema: GetInvoicesSchema,
      field: 'endIssueDate',
    },
    {
      schemaName: 'SearchDealsSchema',
      schema: SearchDealsSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'SummarizeInvoicesSchema',
      schema: SummarizeInvoicesSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'GetManualJournalsSchema',
      schema: GetManualJournalsSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'GetWalletTxnsSchema',
      schema: GetWalletTxnsSchema,
      field: 'startDate',
    },
    {
      schemaName: 'GetTransfersSchema',
      schema: GetTransfersSchema,
      field: 'startDate',
    },
    {
      schemaName: 'GetExpenseApplicationsSchema',
      schema: GetExpenseApplicationsSchema,
      field: 'startIssueDate',
    },
    {
      schemaName: 'GetReceiptsSchema',
      schema: GetReceiptsSchema,
      field: 'startDate',
    },
  ];

  describe.each(optionalDateFieldCases)(
    '$schemaName.$field',
    ({ schema, field }) => {
      const wrapped = z.object({
        [field]: (schema as Record<string, z.ZodTypeAny>)[field],
      });

      it('should allow undefined', () => {
        const result = wrapped.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should reject invalid format "2024/01/01"', () => {
        const result = wrapped.safeParse({ [field]: '2024/01/01' });
        expect(result.success).toBe(false);
      });

      it('should reject semantically invalid date "2024-13-45"', () => {
        const result = wrapped.safeParse({ [field]: '2024-13-45' });
        expect(result.success).toBe(false);
      });
    },
  );
});

// ── offset field validation (.min(0)) ──────────────────────────────────────

describe('offset field validation (.min(0))', () => {
  const offsetCases: {
    schemaName: string;
    schema: Record<string, z.ZodTypeAny>;
  }[] = [
    { schemaName: 'GetDealsSchema', schema: GetDealsSchema },
    { schemaName: 'GetPartnersSchema', schema: GetPartnersSchema },
    { schemaName: 'GetSegmentTagsSchema', schema: GetSegmentTagsSchema },
    { schemaName: 'GetInvoicesSchema', schema: GetInvoicesSchema },
    { schemaName: 'GetManualJournalsSchema', schema: GetManualJournalsSchema },
    { schemaName: 'GetWalletTxnsSchema', schema: GetWalletTxnsSchema },
    { schemaName: 'GetTransfersSchema', schema: GetTransfersSchema },
    {
      schemaName: 'GetExpenseApplicationsSchema',
      schema: GetExpenseApplicationsSchema,
    },
    { schemaName: 'GetReceiptsSchema', schema: GetReceiptsSchema },
  ];

  describe.each(offsetCases)('$schemaName.offset', ({ schema }) => {
    const wrapped = z.object({ offset: schema.offset });

    it('should reject negative number -1', () => {
      const result = wrapped.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept 0', () => {
      const result = wrapped.safeParse({ offset: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept positive number 10', () => {
      const result = wrapped.safeParse({ offset: 10 });
      expect(result.success).toBe(true);
    });

    it('should allow undefined (optional)', () => {
      const result = wrapped.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// ── amount field validation (.min(1)) ──────────────────────────────────────

describe('amount field validation (.min(1))', () => {
  describe('CreateDealSchema details[].amount', () => {
    const detailSchema = z.object(CreateDealSchema).shape.details.element;

    const validDetail = {
      accountItemId: 1,
      taxCode: 1,
      amount: 1000,
      description: 'test',
    };

    it('should reject amount of 0', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount -100', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: -100 });
      expect(result.success).toBe(false);
    });

    it('should accept amount of 1', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept large positive amount 999999', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 999999 });
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateDealSchema details[].amount', () => {
    // UpdateDealSchema.details is optional, but when provided, each element must have amount >= 1
    const detailsField = z.object(UpdateDealSchema).shape.details;
    // details is optional array; unwrap to get the element
    const detailSchema = detailsField.unwrap().element;

    const validDetail = {
      accountItemId: 1,
      taxCode: 1,
      amount: 1000,
    };

    it('should reject amount of 0', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount -50', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: -50 });
      expect(result.success).toBe(false);
    });

    it('should accept amount of 1', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept positive amount 5000', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 5000 });
      expect(result.success).toBe(true);
    });
  });

  describe('CreateDealPaymentSchema.amount', () => {
    const schema = z.object({
      amount: CreateDealPaymentSchema.amount,
    });

    it('should reject amount of 0', () => {
      const result = schema.safeParse({ amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount -1', () => {
      const result = schema.safeParse({ amount: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept amount of 1', () => {
      const result = schema.safeParse({ amount: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept large positive amount 100000', () => {
      const result = schema.safeParse({ amount: 100000 });
      expect(result.success).toBe(true);
    });
  });

  describe('CreateTransferSchema.amount', () => {
    const schema = z.object({
      amount: CreateTransferSchema.amount,
    });

    it('should reject amount of 0', () => {
      const result = schema.safeParse({ amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount -500', () => {
      const result = schema.safeParse({ amount: -500 });
      expect(result.success).toBe(false);
    });

    it('should accept amount of 1', () => {
      const result = schema.safeParse({ amount: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept positive amount 250000', () => {
      const result = schema.safeParse({ amount: 250000 });
      expect(result.success).toBe(true);
    });
  });

  describe('CreateManualJournalSchema details[].amount', () => {
    const detailsField = z.object(CreateManualJournalSchema).shape.details;
    // details is a z.array with .min(2); get the element schema
    const detailSchema = detailsField.element;

    const validDetail = {
      entrySide: 'debit' as const,
      accountItemId: 1,
      taxCode: 1,
      amount: 1000,
    };

    it('should reject amount of 0', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount -200', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: -200 });
      expect(result.success).toBe(false);
    });

    it('should accept amount of 1', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept positive amount 50000', () => {
      const result = detailSchema.safeParse({ ...validDetail, amount: 50000 });
      expect(result.success).toBe(true);
    });
  });
});

// ── Integration: full schema parse with valid/invalid data ─────────────────

describe('Full schema integration tests', () => {
  describe('CreateDealSchema full validation', () => {
    const schema = z.object(CreateDealSchema);

    it('should accept fully valid deal creation data', () => {
      const result = schema.safeParse({
        issueDate: '2024-06-15',
        type: 'expense',
        details: [
          {
            accountItemId: 101,
            taxCode: 2,
            amount: 5000,
            description: 'Office supplies',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject deal with invalid date format', () => {
      const result = schema.safeParse({
        issueDate: '2024/06/15',
        type: 'expense',
        details: [{ accountItemId: 101, taxCode: 2, amount: 5000 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject deal with zero amount in details', () => {
      const result = schema.safeParse({
        issueDate: '2024-06-15',
        type: 'income',
        details: [{ accountItemId: 101, taxCode: 2, amount: 0 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GetDealsSchema full validation', () => {
    const schema = z.object(GetDealsSchema);

    it('should accept valid query with date range and offset', () => {
      const result = schema.safeParse({
        startIssueDate: '2024-01-01',
        endIssueDate: '2024-12-31',
        offset: 0,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });

    it('should reject query with negative offset', () => {
      const result = schema.safeParse({
        startIssueDate: '2024-01-01',
        offset: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject query with invalid date format', () => {
      const result = schema.safeParse({
        startIssueDate: '01-01-2024',
      });
      expect(result.success).toBe(false);
    });

    it('should accept query with all fields omitted', () => {
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('CreateTransferSchema full validation', () => {
    const schema = z.object(CreateTransferSchema);

    it('should accept valid transfer data', () => {
      const result = schema.safeParse({
        date: '2024-03-01',
        amount: 10000,
        fromWalletableId: 1,
        fromWalletableType: 'bank_account',
        toWalletableId: 2,
        toWalletableType: 'wallet',
      });
      expect(result.success).toBe(true);
    });

    it('should reject transfer with invalid date and zero amount', () => {
      const result = schema.safeParse({
        date: '2024-3-1',
        amount: 0,
        fromWalletableId: 1,
        fromWalletableType: 'bank_account',
        toWalletableId: 2,
        toWalletableType: 'wallet',
      });
      expect(result.success).toBe(false);
    });
  });
});
