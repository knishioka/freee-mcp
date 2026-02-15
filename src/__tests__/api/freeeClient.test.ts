import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock TokenManager
jest.mock('../../auth/tokenManager.js');

describe('FreeeClient', () => {
  let client: FreeeClient;
  let mockAxiosInstance: any;
  let mockAuthAxiosInstance: any;
  let mockTokenManager: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock axios instances
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockAuthAxiosInstance = {
      post: jest.fn(),
    };

    // Mock axios.create to return different instances
    let createCallCount = 0;
    mockedAxios.create.mockImplementation(() => {
      createCallCount++;
      return createCallCount === 1 ? mockAxiosInstance : mockAuthAxiosInstance;
    });

    // Create mock TokenManager
    mockTokenManager = {
      getToken: jest.fn(),
      setToken: jest.fn(),
      isTokenExpired: jest.fn(),
      saveTokens: jest.fn(),
      loadTokens: jest.fn(),
      removeToken: jest.fn(),
      getAllCompanyIds: jest.fn(),
      getTokenExpiryStatus: jest.fn(),
    };

    // Create client instance with mocked dependencies
    const MockedTokenManager = TokenManager as jest.MockedClass<
      typeof TokenManager
    >;
    MockedTokenManager.mockImplementation(() => mockTokenManager);

    client = new FreeeClient(
      'test-client-id',
      'test-client-secret',
      'test-redirect-uri',
      mockTokenManager,
    );
  });

  describe('constructor', () => {
    it('should initialize axios instances with correct base URLs', () => {
      expect(mockedAxios.create).toHaveBeenCalledTimes(2);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.freee.co.jp/api/1',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://accounts.secure.freee.co.jp',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('API methods', () => {
    describe('getCompanies', () => {
      it('should fetch companies successfully', async () => {
        const mockCompanies = [
          { id: 1, name: 'Company 1', display_name: 'Company 1' },
          { id: 2, name: 'Company 2', display_name: 'Company 2' },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { companies: mockCompanies },
        });

        const result = await client.getCompanies();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies');
        expect(result).toEqual(mockCompanies);
      });
    });

    describe('getDeals', () => {
      it('should fetch deals with parameters', async () => {
        const mockDeals = [{ id: 1, issue_date: '2024-01-01', amount: 10000 }];

        mockAxiosInstance.get.mockResolvedValue({
          data: { deals: mockDeals },
        });

        const params = {
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-01-31',
          limit: 10,
        };

        const result = await client.getDeals(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/deals', {
          params: { company_id: 123, ...params },
        });
        expect(result).toEqual(mockDeals);
      });
    });

    describe('createDeal', () => {
      it('should create a deal successfully', async () => {
        const mockDeal = {
          id: 1,
          issue_date: '2024-01-01',
          amount: 10000,
        };

        mockAxiosInstance.post.mockResolvedValue({
          data: { deal: mockDeal },
        });

        const dealData = {
          issue_date: '2024-01-01',
          type: 'income' as const,
          amount: 10000,
          status: 'settled',
          details: [
            {
              amount: 10000,
              account_item_id: 1,
              tax_code: 1,
            },
          ],
        };

        const result = await client.createDeal(123, dealData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/deals', {
          company_id: 123,
          ...dealData,
        });
        expect(result).toEqual(mockDeal);
      });
    });

    describe('getInvoices', () => {
      it('should fetch invoices with parameters', async () => {
        const mockInvoices = [
          { id: 1, issue_date: '2024-01-01', total_amount: 10000 },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { invoices: mockInvoices },
        });

        const params = {
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-01-31',
        };

        const result = await client.getInvoices(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/invoices', {
          params: { company_id: 123, ...params },
        });
        expect(result).toEqual(mockInvoices);
      });
    });

    describe('financial reports', () => {
      it('should fetch profit and loss report', async () => {
        const mockReport = {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          created_at: '2024-01-01',
          balances: [],
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: { trial_pl: mockReport },
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
        };

        const result = await client.getProfitLoss(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/reports/trial_pl',
          {
            params: { company_id: 123, ...params },
          },
        );
        expect(result).toEqual(mockReport);
      });

      it('should fetch balance sheet report', async () => {
        const mockReport = {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          created_at: '2024-01-01',
          balances: [],
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: { trial_bs: mockReport },
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
        };

        const result = await client.getBalanceSheet(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/reports/trial_bs',
          {
            params: { company_id: 123, ...params },
          },
        );
        expect(result).toEqual(mockReport);
      });

      it('should fetch trial balance report', async () => {
        const mockReport = {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          created_at: '2024-01-01',
          balances: [],
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: { trial_bs: mockReport },
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
        };

        const result = await client.getTrialBalance(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/reports/trial_bs',
          {
            params: { company_id: 123, ...params },
          },
        );
        expect(result).toEqual(mockReport);
      });
    });

    describe('master data methods', () => {
      it('should fetch account items', async () => {
        const mockItems = [
          { id: 1, name: 'Sales', account_category: 'income' },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { account_items: mockItems },
        });

        const result = await client.getAccountItems(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/account_items', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockItems);
      });

      it('should fetch partners', async () => {
        const mockPartners = [
          { id: 1, company_id: 123, name: 'Partner 1', available: true },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { partners: mockPartners },
        });

        const result = await client.getPartners(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/partners', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockPartners);
      });

      it('should fetch sections', async () => {
        const mockSections = [
          { id: 1, company_id: 123, name: 'Section 1', available: true },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { sections: mockSections },
        });

        const result = await client.getSections(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sections', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockSections);
      });

      it('should fetch tags', async () => {
        const mockTags = [{ id: 1, name: 'Tag 1' }];

        mockAxiosInstance.get.mockResolvedValue({
          data: { tags: mockTags },
        });

        const result = await client.getTags(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tags', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockTags);
      });

      it('should fetch segment tags', async () => {
        const mockSegmentTags = [
          { id: 1, name: 'Department A', description: 'Main dept' },
          { id: 2, name: 'Department B' },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { segment_tags: mockSegmentTags },
        });

        const result = await client.getSegmentTags(123, 1, {
          offset: 0,
          limit: 50,
        });

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/segments/1/tags', {
          params: { company_id: 123, offset: 0, limit: 50 },
        });
        expect(result).toEqual(mockSegmentTags);
      });

      it('should create a segment tag', async () => {
        const mockSegmentTag = {
          id: 1,
          name: 'New Department',
          description: 'A new department',
        };

        mockAxiosInstance.post.mockResolvedValue({
          data: { segment_tag: mockSegmentTag },
        });

        const result = await client.createSegmentTag(123, 2, {
          name: 'New Department',
          description: 'A new department',
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/segments/2/tags',
          {
            company_id: 123,
            name: 'New Department',
            description: 'A new department',
          },
        );
        expect(result).toEqual(mockSegmentTag);
      });
    });

    describe('authentication methods', () => {
      it('should generate authorization URL', () => {
        const url = client.getAuthorizationUrl('test-state');
        expect(url).toContain(
          'https://accounts.secure.freee.co.jp/public_api/authorize',
        );
        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('redirect_uri=test-redirect-uri');
        expect(url).toContain('response_type=code');
        expect(url).toContain('state=test-state');
      });

      it('should exchange authorization code for token', async () => {
        const mockTokenResponse = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 21600,
        };

        mockAuthAxiosInstance.post.mockResolvedValue({
          data: mockTokenResponse,
        });

        const result = await client.getAccessToken('test-code');

        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('grant_type=authorization_code'),
        );
        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('code=test-code'),
        );
        expect(result).toEqual(mockTokenResponse);
      });

      it('should refresh access token', async () => {
        const mockTokenResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 21600,
        };

        mockAuthAxiosInstance.post.mockResolvedValue({
          data: mockTokenResponse,
        });

        await client.refreshToken(123, 'old-refresh-token');

        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('grant_type=refresh_token'),
        );
        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('refresh_token=old-refresh-token'),
        );
        expect(mockTokenManager.setToken).toHaveBeenCalledWith(
          123,
          mockTokenResponse,
        );
      });
    });

    describe('getWalletables', () => {
      it('should fetch walletables with parameters', async () => {
        const mockWalletables = [
          {
            id: 1,
            name: 'Main Bank',
            type: 'bank_account',
            last_balance: 100000,
          },
          { id: 2, name: 'Corp Card', type: 'credit_card' },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { walletables: mockWalletables },
        });

        const result = await client.getWalletables(123, {
          with_balance: true,
        });

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/walletables', {
          params: { company_id: 123, with_balance: true },
        });
        expect(result).toEqual(mockWalletables);
      });
    });

    describe('getManualJournals', () => {
      it('should fetch manual journals with parameters', async () => {
        const mockJournals = [
          {
            id: 1,
            company_id: 123,
            issue_date: '2024-01-01',
            adjustment: false,
            details: [],
          },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { manual_journals: mockJournals },
        });

        const params = {
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-01-31',
          entry_side: 'debit',
          min_amount: 1000,
          max_amount: 50000,
          limit: 500,
        };

        const result = await client.getManualJournals(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/manual_journals', {
          params: { company_id: 123, ...params },
        });
        expect(result).toEqual(mockJournals);
      });
    });

    describe('getManualJournal', () => {
      it('should fetch a single manual journal by ID', async () => {
        const mockJournal = {
          id: 42,
          company_id: 123,
          issue_date: '2024-01-15',
          adjustment: true,
          details: [
            {
              id: 1,
              entry_side: 'debit',
              account_item_id: 100,
              amount: 5000,
            },
            {
              id: 2,
              entry_side: 'credit',
              account_item_id: 200,
              amount: 5000,
            },
          ],
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: { manual_journal: mockJournal },
        });

        const result = await client.getManualJournal(123, 42);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/manual_journals/42',
          {
            params: { company_id: 123 },
          },
        );
        expect(result).toEqual(mockJournal);
      });
    });

    describe('getTransfers', () => {
      it('should fetch transfers with parameters', async () => {
        const mockTransfers = [
          {
            id: 1,
            company_id: 123,
            date: '2024-01-15',
            amount: 50000,
            from_walletable_id: 1,
            from_walletable_type: 'bank_account',
            to_walletable_id: 2,
            to_walletable_type: 'bank_account',
            description: 'Monthly transfer',
          },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { transfers: mockTransfers },
        });

        const params = {
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          walletable_id: 1,
          walletable_type: 'bank_account' as const,
          offset: 0,
          limit: 100,
        };

        const result = await client.getTransfers(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transfers', {
          params: { company_id: 123, ...params },
        });
        expect(result).toEqual(mockTransfers);
      });

      it('should fetch transfers without optional parameters', async () => {
        const mockTransfers = [
          {
            id: 1,
            company_id: 123,
            date: '2024-01-15',
            amount: 50000,
            from_walletable_id: 1,
            from_walletable_type: 'bank_account',
            to_walletable_id: 2,
            to_walletable_type: 'bank_account',
          },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { transfers: mockTransfers },
        });

        const result = await client.getTransfers(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transfers', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockTransfers);
      });
    });

    describe('getTransfer', () => {
      it('should fetch a single transfer by ID', async () => {
        const mockTransfer = {
          id: 42,
          company_id: 123,
          date: '2024-01-15',
          amount: 100000,
          from_walletable_id: 1,
          from_walletable_type: 'bank_account',
          to_walletable_id: 3,
          to_walletable_type: 'credit_card',
          description: 'Credit card payment',
        };

        mockAxiosInstance.get.mockResolvedValue({
          data: { transfer: mockTransfer },
        });

        const result = await client.getTransfer(123, 42);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transfers/42', {
          params: { company_id: 123 },
        });
        expect(result).toEqual(mockTransfer);
      });
    });

    describe('createTransfer', () => {
      it('should create a transfer successfully', async () => {
        const mockTransfer = {
          id: 99,
          company_id: 123,
          date: '2024-02-01',
          amount: 200000,
          from_walletable_id: 1,
          from_walletable_type: 'bank_account',
          to_walletable_id: 2,
          to_walletable_type: 'bank_account',
          description: 'Inter-account transfer',
        };

        mockAxiosInstance.post.mockResolvedValue({
          data: { transfer: mockTransfer },
        });

        const transferData = {
          date: '2024-02-01',
          amount: 200000,
          from_walletable_id: 1,
          from_walletable_type: 'bank_account' as const,
          to_walletable_id: 2,
          to_walletable_type: 'bank_account' as const,
          description: 'Inter-account transfer',
        };

        const result = await client.createTransfer(123, transferData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/transfers',
          { company_id: 123, ...transferData },
          { params: { company_id: 123 } },
        );
        expect(result).toEqual(mockTransfer);
      });

      it('should create a transfer without optional description', async () => {
        const mockTransfer = {
          id: 100,
          company_id: 123,
          date: '2024-02-01',
          amount: 50000,
          from_walletable_id: 1,
          from_walletable_type: 'bank_account',
          to_walletable_id: 4,
          to_walletable_type: 'wallet',
        };

        mockAxiosInstance.post.mockResolvedValue({
          data: { transfer: mockTransfer },
        });

        const transferData = {
          date: '2024-02-01',
          amount: 50000,
          from_walletable_id: 1,
          from_walletable_type: 'bank_account' as const,
          to_walletable_id: 4,
          to_walletable_type: 'wallet' as const,
        };

        const result = await client.createTransfer(123, transferData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/transfers',
          { company_id: 123, ...transferData },
          { params: { company_id: 123 } },
        );
        expect(result).toEqual(mockTransfer);
      });
    });

    describe('getWalletTxns', () => {
      it('should fetch wallet transactions with parameters', async () => {
        const mockTxns = [
          {
            id: 1,
            company_id: 123,
            date: '2024-01-01',
            amount: 10000,
            due_amount: 10000,
            entry_side: 'income',
            walletable_type: 'bank_account',
            walletable_id: 1,
            status: 1,
          },
        ];

        mockAxiosInstance.get.mockResolvedValue({
          data: { wallet_txns: mockTxns },
        });

        const params = {
          walletable_type: 'bank_account',
          walletable_id: 1,
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          entry_side: 'income',
          limit: 100,
        };

        const result = await client.getWalletTxns(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/wallet_txns', {
          params: { company_id: 123, ...params },
        });
        expect(result).toEqual(mockTxns);
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors with error message', async () => {
      // We need to trigger the error handler in the response interceptor
      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        response: {
          status: 400,
          data: {
            errors: [
              {
                messages: ['Invalid request parameters'],
              },
            ],
          },
        },
        config: {},
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'freee API Error: Invalid request parameters',
      );
    });

    it('should handle API errors without message', async () => {
      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        response: {
          status: 400,
        },
        message: 'Network error',
        config: {},
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'freee API Error: Network error',
      );
    });
  });

  describe('interceptors', () => {
    it('should add authorization header in request interceptor', async () => {
      const mockToken = { access_token: 'test-token' };
      mockTokenManager.getToken.mockReturnValue(mockToken);
      mockTokenManager.getTokenExpiryStatus.mockReturnValue({
        status: 'valid',
        remainingMinutes: 300,
      });

      // Get the request interceptor
      const requestInterceptor =
        mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config = {
        headers: {},
        params: { company_id: 123 },
      };

      const result = await requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
      expect(mockTokenManager.getToken).toHaveBeenCalledWith(123);
    });

    it('should handle 401 errors in response interceptor', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to succeed (must return a Promise for refreshTokenWithLock)
      const mockRefresh = jest.fn(() => Promise.resolve());
      (client as any).refreshToken = mockRefresh;

      // Get the error handler from response interceptor
      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const originalRequest = {
        params: { company_id: 123 },
        headers: {},
      };

      const error = {
        config: originalRequest,
        response: { status: 401 },
      };

      // Mock the retry request
      mockAxiosInstance.request.mockResolvedValue({ data: 'success' });

      const result = await errorHandler(error);

      expect((client as any).refreshToken).toHaveBeenCalledWith(
        123,
        'refresh-token',
      );
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(originalRequest);
      expect(result).toEqual({ data: 'success' });
    });

    it('should deduplicate concurrent refresh requests for the same company', async () => {
      let resolveRefresh: () => void;
      const refreshPromise = new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      });

      // Mock refreshToken to return a delayed promise
      (client as any).refreshToken = jest
        .fn()
        .mockReturnValue(refreshPromise) as any;

      // Call refreshTokenWithLock twice for the same company
      const promise1 = (client as any).refreshTokenWithLock(
        123,
        'refresh-token',
      );
      const promise2 = (client as any).refreshTokenWithLock(
        123,
        'refresh-token',
      );

      // Resolve the refresh
      resolveRefresh!();
      await Promise.all([promise1, promise2]);

      // Should only call refreshToken once
      expect((client as any).refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should allow independent refresh for different companies', async () => {
      (client as any).refreshToken = jest.fn(() => Promise.resolve());

      // Call refreshTokenWithLock for two different companies
      await Promise.all([
        (client as any).refreshTokenWithLock(123, 'token-1'),
        (client as any).refreshTokenWithLock(456, 'token-2'),
      ]);

      // Should call refreshToken for each company
      expect((client as any).refreshToken).toHaveBeenCalledTimes(2);
      expect((client as any).refreshToken).toHaveBeenCalledWith(123, 'token-1');
      expect((client as any).refreshToken).toHaveBeenCalledWith(456, 'token-2');
    });

    it('should clean up refresh promise after completion', async () => {
      (client as any).refreshToken = jest.fn(() => Promise.resolve());

      await (client as any).refreshTokenWithLock(123, 'refresh-token');

      // After completion, refreshPromises map should be empty
      expect((client as any).refreshPromises.size).toBe(0);
    });

    it('should clean up refresh promise after failure', async () => {
      (client as any).refreshToken = jest.fn(() =>
        Promise.reject(new Error('refresh failed')),
      );

      await expect(
        (client as any).refreshTokenWithLock(123, 'refresh-token'),
      ).rejects.toThrow('refresh failed');

      // After failure, refreshPromises map should be empty
      expect((client as any).refreshPromises.size).toBe(0);
    });

    it('should trigger background refresh on near-expiry tokens', async () => {
      const mockToken = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
      };
      mockTokenManager.getToken.mockReturnValue(mockToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);
      mockTokenManager.getTokenExpiryStatus.mockReturnValue({
        status: 'near_expiry',
        remainingMinutes: 20,
      });

      // Mock refreshToken to succeed
      (client as any).refreshToken = jest.fn(() => Promise.resolve());

      // Get the request interceptor
      const requestInterceptor =
        mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config = {
        headers: {},
        params: { company_id: 123 },
      };

      const result = await requestInterceptor(config);

      // Should set current token (not block)
      expect(result.headers.Authorization).toBe('Bearer test-token');

      // Wait for background refresh to complete
      await new Promise((resolve) => process.nextTick(resolve));

      // Should have triggered background refresh
      expect((client as any).refreshToken).toHaveBeenCalledWith(
        123,
        'refresh-token',
      );
    });

    it('should prevent infinite 401 retry loops with retry guard', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to succeed
      (client as any).refreshToken = jest.fn(() => Promise.resolve());

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      // Simulate a request that has already been retried
      const retriedRequest = {
        params: { company_id: 123 },
        headers: {},
        __retried: true,
      };

      const error = {
        config: retriedRequest,
        response: { status: 401 },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'Authentication failed after token refresh. Please re-authenticate.',
      );

      // Should NOT attempt another refresh
      expect((client as any).refreshToken).not.toHaveBeenCalled();
    });

    it('should set __retried flag on request config before retry', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to succeed
      (client as any).refreshToken = jest.fn(() => Promise.resolve());

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const originalRequest = {
        params: { company_id: 123 },
        headers: {},
      };

      const error = {
        config: originalRequest,
        response: { status: 401 },
      };

      mockAxiosInstance.request.mockResolvedValue({ data: 'success' });

      await errorHandler(error);

      // Verify __retried flag was set on the config before retry
      expect(originalRequest).toHaveProperty('__retried', true);
    });

    it('should preserve token on transient refresh errors (network error)', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to fail with network error (no response)
      const networkError = new Error('Network Error');
      (client as any).refreshToken = jest.fn(() =>
        Promise.reject(networkError),
      );

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        config: {
          params: { company_id: 123 },
          headers: {},
        },
        response: { status: 401 },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'Token refresh failed: Network Error',
      );

      // Token should NOT be deleted on transient errors
      expect(mockTokenManager.removeToken).not.toHaveBeenCalled();
    });

    it('should delete token on invalid_grant error', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      // Both calls return same token (no concurrent refresh succeeded)
      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to fail with invalid_grant
      const invalidGrantError = {
        response: { data: { error: 'invalid_grant' } },
        message: 'invalid_grant',
      };
      (client as any).refreshToken = jest.fn(() =>
        Promise.reject(invalidGrantError),
      );

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        config: {
          params: { company_id: 123 },
          headers: {},
        },
        response: { status: 401 },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'Authentication expired. Please re-authenticate using freee_get_auth_url.',
      );

      // Token SHOULD be deleted on invalid_grant
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(123);
    });

    it('should delete token on invalid_client error', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to fail with invalid_client
      const invalidClientError = {
        response: { data: { error: 'invalid_client' } },
        message: 'invalid_client',
      };
      (client as any).refreshToken = jest.fn(() =>
        Promise.reject(invalidClientError),
      );

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        config: {
          params: { company_id: 123 },
          headers: {},
        },
        response: { status: 401 },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'Token refresh failed: invalid_client',
      );

      // Token SHOULD be deleted on invalid_client
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(123);
    });

    it('should re-check token state on invalid_grant before deleting', async () => {
      const mockOldToken = {
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };
      const mockNewToken = {
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
      };

      // First call returns old token, second call returns new token (refreshed by another request)
      mockTokenManager.getToken
        .mockReturnValueOnce(mockOldToken)
        .mockReturnValueOnce(mockNewToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);

      // Mock refreshToken to fail with invalid_grant
      const invalidGrantError = {
        response: { data: { error: 'invalid_grant' } },
        message: 'invalid_grant',
      };
      (client as any).refreshToken = jest.fn(() =>
        Promise.reject(invalidGrantError),
      );

      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const originalRequest = {
        params: { company_id: 123 },
        headers: {},
      };

      const error = {
        config: originalRequest,
        response: { status: 401 },
      };

      // Mock retry to succeed with new token
      mockAxiosInstance.request.mockResolvedValue({ data: 'success' });

      const result = await errorHandler(error);

      // Should NOT have removed the token (another refresh succeeded)
      expect(mockTokenManager.removeToken).not.toHaveBeenCalled();
      // Should have retried the request
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(originalRequest);
      expect(result).toEqual({ data: 'success' });
    });
  });
});
