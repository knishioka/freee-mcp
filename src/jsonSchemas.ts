// JSON Schema definitions for MCP tools

// Auth schemas
export const AuthorizeSchema = {
  type: 'object',
  properties: {
    state: { 
      type: 'string', 
      description: 'Optional state parameter for CSRF protection' 
    }
  }
};

export const GetTokenSchema = {
  type: 'object',
  properties: {
    code: { 
      type: 'string', 
      description: 'Authorization code from OAuth flow' 
    }
  },
  required: ['code']
};

export const SetCompanyTokenSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID to set token for' 
    },
    accessToken: { 
      type: 'string', 
      description: 'OAuth access token' 
    },
    refreshToken: { 
      type: 'string', 
      description: 'OAuth refresh token' 
    },
    expiresIn: { 
      type: 'number', 
      description: 'Token expiration time in seconds' 
    }
  },
  required: ['companyId', 'accessToken', 'refreshToken', 'expiresIn']
};

// Company schemas
export const GetCompaniesSchema = {
  type: 'object',
  properties: {}
};

export const GetCompanySchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    }
  },
  required: []
};

// Deal schemas
export const GetDealsSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    partnerId: { 
      type: 'number', 
      description: 'Partner ID to filter by' 
    },
    accountItemId: { 
      type: 'number', 
      description: 'Account item ID to filter by' 
    },
    startIssueDate: { 
      type: 'string', 
      description: 'Start date (YYYY-MM-DD)' 
    },
    endIssueDate: { 
      type: 'string', 
      description: 'End date (YYYY-MM-DD)' 
    },
    offset: { 
      type: 'number', 
      description: 'Pagination offset' 
    },
    limit: { 
      type: 'number', 
      description: 'Number of results (1-100)', 
      minimum: 1, 
      maximum: 100 
    }
  },
  required: []
};

export const GetDealSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    dealId: { 
      type: 'number', 
      description: 'Deal ID' 
    }
  },
  required: ['dealId']
};

export const CreateDealSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    issueDate: { 
      type: 'string', 
      description: 'Issue date (YYYY-MM-DD)' 
    },
    type: { 
      type: 'string', 
      enum: ['income', 'expense'], 
      description: 'Transaction type' 
    },
    partnerId: { 
      type: 'number', 
      description: 'Partner ID' 
    },
    dueDate: { 
      type: 'string', 
      description: 'Due date (YYYY-MM-DD)' 
    },
    refNumber: { 
      type: 'string', 
      description: 'Reference number' 
    },
    details: {
      type: 'array',
      description: 'Transaction details',
      items: {
        type: 'object',
        properties: {
          accountItemId: { 
            type: 'number', 
            description: 'Account item ID' 
          },
          taxCode: { 
            type: 'number', 
            description: 'Tax code' 
          },
          amount: { 
            type: 'number', 
            description: 'Amount' 
          },
          description: { 
            type: 'string', 
            description: 'Description' 
          },
          sectionId: { 
            type: 'number', 
            description: 'Section ID' 
          },
          tagIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Tag IDs'
          }
        },
        required: ['accountItemId', 'taxCode', 'amount']
      }
    }
  },
  required: ['issueDate', 'type', 'details']
};

// Account Item schemas
export const GetAccountItemsSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    accountCategory: { 
      type: 'string', 
      description: 'Account category to filter by' 
    }
  },
  required: []
};

// Partner schemas
export const GetPartnersSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    name: { 
      type: 'string', 
      description: 'Partner name to search' 
    },
    shortcut1: { 
      type: 'string', 
      description: 'Shortcut 1 to search' 
    },
    offset: { 
      type: 'number', 
      description: 'Pagination offset' 
    },
    limit: { 
      type: 'number', 
      description: 'Number of results (1-100)', 
      minimum: 1, 
      maximum: 100 
    }
  },
  required: []
};

export const CreatePartnerSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    name: { 
      type: 'string', 
      description: 'Partner name' 
    },
    shortcut1: { 
      type: 'string', 
      description: 'Shortcut 1' 
    },
    shortcut2: { 
      type: 'string', 
      description: 'Shortcut 2' 
    },
    longName: { 
      type: 'string', 
      description: 'Long name' 
    },
    nameKana: { 
      type: 'string', 
      description: 'Name in Kana' 
    },
    countryCode: { 
      type: 'string', 
      description: 'Country code' 
    }
  },
  required: ['name']
};

// Section schemas
export const GetSectionsSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    }
  },
  required: []
};

// Tag schemas
export const GetTagsSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    }
  },
  required: []
};

// Invoice schemas
export const GetInvoicesSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    partnerId: { 
      type: 'number', 
      description: 'Partner ID to filter by' 
    },
    invoiceStatus: { 
      type: 'string', 
      description: 'Invoice status to filter by' 
    },
    paymentStatus: { 
      type: 'string', 
      description: 'Payment status to filter by' 
    },
    startIssueDate: { 
      type: 'string', 
      description: 'Start date (YYYY-MM-DD)' 
    },
    endIssueDate: { 
      type: 'string', 
      description: 'End date (YYYY-MM-DD)' 
    },
    offset: { 
      type: 'number', 
      description: 'Pagination offset' 
    },
    limit: { 
      type: 'number', 
      description: 'Number of results (1-100)', 
      minimum: 1, 
      maximum: 100 
    }
  },
  required: []
};

export const CreateInvoiceSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    issueDate: { 
      type: 'string', 
      description: 'Issue date (YYYY-MM-DD)' 
    },
    partnerId: { 
      type: 'number', 
      description: 'Partner ID' 
    },
    dueDate: { 
      type: 'string', 
      description: 'Due date (YYYY-MM-DD)' 
    },
    title: { 
      type: 'string', 
      description: 'Invoice title' 
    },
    invoiceStatus: { 
      type: 'string', 
      enum: ['draft', 'issue', 'sent', 'settled'], 
      description: 'Invoice status' 
    },
    invoiceLines: {
      type: 'array',
      description: 'Invoice line items',
      items: {
        type: 'object',
        properties: {
          name: { 
            type: 'string', 
            description: 'Item name' 
          },
          quantity: { 
            type: 'number', 
            description: 'Quantity' 
          },
          unitPrice: { 
            type: 'number', 
            description: 'Unit price' 
          },
          description: { 
            type: 'string', 
            description: 'Description' 
          },
          taxCode: { 
            type: 'number', 
            description: 'Tax code' 
          },
          accountItemId: { 
            type: 'number', 
            description: 'Account item ID' 
          }
        },
        required: ['name', 'quantity', 'unitPrice']
      }
    }
  },
  required: ['issueDate', 'partnerId', 'invoiceStatus', 'invoiceLines']
};

// Trial Balance schemas
export const GetTrialBalanceSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    fiscalYear: { 
      type: 'number', 
      description: 'Fiscal year' 
    },
    startMonth: { 
      type: 'number', 
      description: 'Start month (1-12)', 
      minimum: 1, 
      maximum: 12 
    },
    endMonth: { 
      type: 'number', 
      description: 'End month (1-12)', 
      minimum: 1, 
      maximum: 12 
    }
  },
  required: ['fiscalYear', 'startMonth', 'endMonth']
};

// Financial Report schemas
export const GetProfitLossSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    fiscalYear: { 
      type: 'number', 
      description: 'Fiscal year' 
    },
    startMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'Start month (1-12)' 
    },
    endMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'End month (1-12)' 
    },
    breakdownDisplayType: {
      type: 'string',
      enum: ['partner', 'item', 'section', 'tag'],
      description: 'Breakdown display type (optional)'
    }
  },
  required: ['fiscalYear', 'startMonth', 'endMonth']
};

export const GetBalanceSheetSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    fiscalYear: { 
      type: 'number', 
      description: 'Fiscal year' 
    },
    startMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'Start month (1-12)' 
    },
    endMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'End month (1-12)' 
    },
    breakdownDisplayType: {
      type: 'string',
      enum: ['partner', 'item', 'section', 'tag'],
      description: 'Breakdown display type (optional)'
    }
  },
  required: ['fiscalYear', 'startMonth', 'endMonth']
};

export const GetCashFlowSchema = {
  type: 'object',
  properties: {
    companyId: { 
      type: 'number', 
      description: 'Company ID (optional, uses FREEE_DEFAULT_COMPANY_ID if not provided)' 
    },
    fiscalYear: { 
      type: 'number', 
      description: 'Fiscal year' 
    },
    startMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'Start month (1-12)' 
    },
    endMonth: { 
      type: 'number', 
      minimum: 1, 
      maximum: 12, 
      description: 'End month (1-12)' 
    }
  },
  required: ['fiscalYear', 'startMonth', 'endMonth']
};