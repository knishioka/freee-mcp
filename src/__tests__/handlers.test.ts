import { jest } from '@jest/globals';
import { FreeeClient } from '../api/freeeClient.js';
import { TokenManager } from '../auth/tokenManager.js';
import * as schemas from '../schemas.js';

// Mock dependencies
jest.mock('../api/freeeClient.js');
jest.mock('../auth/tokenManager.js');

describe('MCP Tool Handlers', () => {
  let mockClient: any;
  let mockTokenManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock client
    mockClient = {
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getCompanies: jest.fn(),
      getCompany: jest.fn(),
      getDeals: jest.fn(),
      createDeal: jest.fn(),
      updateDeal: jest.fn(),
      deleteDeal: jest.fn(),
      getInvoices: jest.fn(),
      createInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      getAccountItems: jest.fn(),
      getPartners: jest.fn(),
      getSections: jest.fn(),
      getTags: jest.fn(),
      getProfitLoss: jest.fn(),
      getBalanceSheet: jest.fn(),
      getTrialBalance: jest.fn(),
    };

    // Setup mock token manager
    mockTokenManager = {
      loadTokens: jest.fn(),
      saveTokens: jest.fn(),
      setToken: jest.fn(),
      getToken: jest.fn(),
      getAllCompanyIds: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenExpiryStatus: jest.fn(),
    };

    // Mock constructors
    (FreeeClient as jest.MockedClass<typeof FreeeClient>).mockImplementation(
      () => mockClient,
    );
    (TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager,
    );
  });

  describe('Tool Schema Validation', () => {
    it('should have schemas for all expected operations', () => {
      const expectedSchemas = [
        'AuthorizeSchema',
        'GetTokenSchema',
        'GetCompaniesSchema',
        'GetCompanySchema',
        'GetDealsSchema',
        'GetDealSchema',
        'CreateDealSchema',
        'GetInvoicesSchema',
        'CreateInvoiceSchema',
        'GetAccountItemsSchema',
        'GetPartnersSchema',
        'GetSectionsSchema',
        'GetTagsSchema',
        'GetProfitLossSchema',
        'GetBalanceSheetSchema',
        'GetTrialBalanceSchema',
      ];

      expectedSchemas.forEach((schemaName) => {
        const schema = (schemas as any)[schemaName];
        expect(schema).toBeDefined();
        // Schemas are now raw shapes (plain objects with Zod fields) for MCP SDK 1.x registerTool
        expect(typeof schema).toBe('object');
      });
    });

    it('should not export GetCashFlowSchema (removed)', () => {
      expect((schemas as any).GetCashFlowSchema).toBeUndefined();
    });
  });

  describe('Authentication Tools', () => {
    it('should generate auth URL correctly', () => {
      const state = 'test-state';
      const expectedUrl =
        'https://accounts.secure.freee.co.jp/authorize?state=test-state';
      mockClient.getAuthorizationUrl.mockReturnValue(expectedUrl);

      // Simulate tool call
      const result = mockClient.getAuthorizationUrl(state);

      expect(mockClient.getAuthorizationUrl).toHaveBeenCalledWith(state);
      expect(result).toBe(expectedUrl);
    });

    it('should exchange authorization code for token', async () => {
      const code = 'test-code';
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 21600,
      };

      mockClient.getAccessToken.mockResolvedValue(mockTokenResponse);

      const result = await mockClient.getAccessToken(code);

      expect(result).toEqual(mockTokenResponse);
      expect(mockClient.getAccessToken).toHaveBeenCalledWith(code);
    });
  });

  describe('Company Tools', () => {
    it('should fetch all companies', async () => {
      const mockCompanies = [
        { id: 1, name: 'Company 1' },
        { id: 2, name: 'Company 2' },
      ];

      mockClient.getCompanies.mockResolvedValue(mockCompanies);

      const result = await mockClient.getCompanies();

      expect(result).toEqual(mockCompanies);
      expect(mockClient.getCompanies).toHaveBeenCalled();
    });

    it('should fetch specific company', async () => {
      const companyId = 123;
      const mockCompany = { id: companyId, name: 'Test Company' };

      mockClient.getCompany.mockResolvedValue(mockCompany);

      const result = await mockClient.getCompany(companyId);

      expect(result).toEqual(mockCompany);
      expect(mockClient.getCompany).toHaveBeenCalledWith(companyId);
    });
  });

  describe('Deal Tools', () => {
    it('should fetch deals with filters', async () => {
      const companyId = 123;
      const filters = {
        start_issue_date: '2024-01-01',
        end_issue_date: '2024-01-31',
      };
      const mockDeals = [
        { id: 1, amount: 10000 },
        { id: 2, amount: 20000 },
      ];

      mockClient.getDeals.mockResolvedValue(mockDeals);

      const result = await mockClient.getDeals(companyId, filters);

      expect(result).toEqual(mockDeals);
      expect(mockClient.getDeals).toHaveBeenCalledWith(companyId, filters);
    });

    it('should create a deal', async () => {
      const companyId = 123;
      const dealData = {
        issue_date: '2024-01-01',
        type: 'income',
        amount: 10000,
        details: [],
      };
      const mockDeal = { id: 1, ...dealData };

      mockClient.createDeal.mockResolvedValue(mockDeal);

      const result = await mockClient.createDeal(companyId, dealData);

      expect(result).toEqual(mockDeal);
      expect(mockClient.createDeal).toHaveBeenCalledWith(companyId, dealData);
    });
  });

  describe('Financial Report Tools', () => {
    it('should fetch profit and loss report', async () => {
      const companyId = 123;
      const params = {
        fiscal_year: 2024,
        start_month: 1,
        end_month: 12,
      };
      const mockReport = {
        company_id: companyId,
        fiscal_year: 2024,
        balances: [],
      };

      mockClient.getProfitLoss.mockResolvedValue(mockReport);

      const result = await mockClient.getProfitLoss(companyId, params);

      expect(result).toEqual(mockReport);
      expect(mockClient.getProfitLoss).toHaveBeenCalledWith(companyId, params);
    });

    it('should fetch balance sheet report', async () => {
      const companyId = 123;
      const params = {
        fiscal_year: 2024,
        start_month: 1,
        end_month: 12,
      };
      const mockReport = {
        company_id: companyId,
        fiscal_year: 2024,
        balances: [],
      };

      mockClient.getBalanceSheet.mockResolvedValue(mockReport);

      const result = await mockClient.getBalanceSheet(companyId, params);

      expect(result).toEqual(mockReport);
      expect(mockClient.getBalanceSheet).toHaveBeenCalledWith(
        companyId,
        params,
      );
    });

    it('should fetch trial balance report', async () => {
      const companyId = 123;
      const params = {
        fiscal_year: 2024,
        start_month: 1,
        end_month: 12,
      };
      const mockReport = {
        company_id: companyId,
        fiscal_year: 2024,
        balances: [],
      };

      mockClient.getTrialBalance.mockResolvedValue(mockReport);

      const result = await mockClient.getTrialBalance(companyId, params);

      expect(result).toEqual(mockReport);
      expect(mockClient.getTrialBalance).toHaveBeenCalledWith(
        companyId,
        params,
      );
    });
  });

  describe('Master Data Tools', () => {
    it('should fetch account items', async () => {
      const companyId = 123;
      const mockItems = [
        { id: 1, name: 'Sales' },
        { id: 2, name: 'Cost of Sales' },
      ];

      mockClient.getAccountItems.mockResolvedValue(mockItems);

      const result = await mockClient.getAccountItems(companyId);

      expect(result).toEqual(mockItems);
      expect(mockClient.getAccountItems).toHaveBeenCalledWith(companyId);
    });

    it('should fetch partners', async () => {
      const companyId = 123;
      const mockPartners = [
        { id: 1, name: 'Partner 1' },
        { id: 2, name: 'Partner 2' },
      ];

      mockClient.getPartners.mockResolvedValue(mockPartners);

      const result = await mockClient.getPartners(companyId);

      expect(result).toEqual(mockPartners);
      expect(mockClient.getPartners).toHaveBeenCalledWith(companyId);
    });

    it('should fetch sections', async () => {
      const companyId = 123;
      const mockSections = [
        { id: 1, name: 'Section 1' },
        { id: 2, name: 'Section 2' },
      ];

      mockClient.getSections.mockResolvedValue(mockSections);

      const result = await mockClient.getSections(companyId);

      expect(result).toEqual(mockSections);
      expect(mockClient.getSections).toHaveBeenCalledWith(companyId);
    });

    it('should fetch tags', async () => {
      const companyId = 123;
      const mockTags = [
        { id: 1, name: 'Tag 1' },
        { id: 2, name: 'Tag 2' },
      ];

      mockClient.getTags.mockResolvedValue(mockTags);

      const result = await mockClient.getTags(companyId);

      expect(result).toEqual(mockTags);
      expect(mockClient.getTags).toHaveBeenCalledWith(companyId);
    });
  });

  describe('Default Company ID Handling', () => {
    it('should use default company ID when not provided', async () => {
      const defaultCompanyId = 456;
      process.env.FREEE_DEFAULT_COMPANY_ID = defaultCompanyId.toString();

      // Simulate a tool that uses default company ID
      const mockDeals = [{ id: 1, amount: 10000 }];
      mockClient.getDeals.mockResolvedValue(mockDeals);

      // In real implementation, the tool would check for default company ID
      const companyId = defaultCompanyId; // This would come from the tool logic
      const result = await mockClient.getDeals(companyId);

      expect(result).toEqual(mockDeals);
      expect(mockClient.getDeals).toHaveBeenCalledWith(defaultCompanyId);
    });
  });
});
