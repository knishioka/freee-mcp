import { z } from 'zod';

// Auth schemas
export const AuthorizeSchema = z.object({
  state: z.string().optional(),
});

export const GetTokenSchema = z.object({
  code: z.string(),
});

export const SetCompanyTokenSchema = z.object({
  companyId: z.number(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

// Company schemas
export const GetCompaniesSchema = z.object({});

export const GetCompanySchema = z.object({
  companyId: z.number().optional(),
});

// Deal schemas
export const GetDealsSchema = z.object({
  companyId: z.number().optional(),
  partnerId: z.number().optional(),
  accountItemId: z.number().optional(),
  startIssueDate: z.string().optional(),
  endIssueDate: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const GetDealSchema = z.object({
  companyId: z.number().optional(),
  dealId: z.number(),
});

export const CreateDealSchema = z.object({
  companyId: z.number().optional(),
  issueDate: z.string(),
  type: z.enum(['income', 'expense']),
  partnerId: z.number().optional(),
  dueDate: z.string().optional(),
  refNumber: z.string().optional(),
  details: z.array(z.object({
    accountItemId: z.number(),
    taxCode: z.number(),
    amount: z.number(),
    description: z.string().optional(),
    sectionId: z.number().optional(),
    tagIds: z.array(z.number()).optional(),
  })),
});

// Account Item schemas
export const GetAccountItemsSchema = z.object({
  companyId: z.number().optional(),
  accountCategory: z.string().optional(),
});

// Partner schemas
export const GetPartnersSchema = z.object({
  companyId: z.number().optional(),
  name: z.string().optional(),
  shortcut1: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const CreatePartnerSchema = z.object({
  companyId: z.number().optional(),
  name: z.string(),
  shortcut1: z.string().optional(),
  shortcut2: z.string().optional(),
  longName: z.string().optional(),
  nameKana: z.string().optional(),
  countryCode: z.string().optional(),
});

// Section schemas
export const GetSectionsSchema = z.object({
  companyId: z.number().optional(),
});

// Tag schemas
export const GetTagsSchema = z.object({
  companyId: z.number().optional(),
});

// Invoice schemas
export const GetInvoicesSchema = z.object({
  companyId: z.number().optional(),
  partnerId: z.number().optional(),
  invoiceStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  startIssueDate: z.string().optional(),
  endIssueDate: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const CreateInvoiceSchema = z.object({
  companyId: z.number().optional(),
  issueDate: z.string(),
  partnerId: z.number(),
  dueDate: z.string().optional(),
  title: z.string().optional(),
  invoiceStatus: z.enum(['draft', 'issue', 'sent', 'settled']),
  invoiceLines: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    description: z.string().optional(),
    taxCode: z.number().optional(),
    accountItemId: z.number().optional(),
  })),
});

// Trial Balance schemas
export const GetTrialBalanceSchema = z.object({
  companyId: z.number().optional(),
  fiscalYear: z.number(),
  startMonth: z.number().min(1).max(12),
  endMonth: z.number().min(1).max(12),
});