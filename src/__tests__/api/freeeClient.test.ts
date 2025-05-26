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
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    };

    mockAuthAxiosInstance = {
      post: jest.fn()
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
      getTokenExpiryStatus: jest.fn()
    };

    // Create client instance with mocked dependencies
    const MockedTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>;
    MockedTokenManager.mockImplementation(() => mockTokenManager);

    client = new FreeeClient(
      'test-client-id',
      'test-client-secret',
      'test-redirect-uri',
      mockTokenManager
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
          { id: 2, name: 'Company 2', display_name: 'Company 2' }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { companies: mockCompanies } 
        });

        const result = await client.getCompanies();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies');
        expect(result).toEqual(mockCompanies);
      });
    });

    describe('getDeals', () => {
      it('should fetch deals with parameters', async () => {
        const mockDeals = [
          { id: 1, issue_date: '2024-01-01', amount: 10000 }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { deals: mockDeals } 
        });

        const params = {
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-01-31',
          limit: 10
        };

        const result = await client.getDeals(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/deals', { 
          params: { company_id: 123, ...params } 
        });
        expect(result).toEqual(mockDeals);
      });
    });

    describe('createDeal', () => {
      it('should create a deal successfully', async () => {
        const mockDeal = { 
          id: 1, 
          issue_date: '2024-01-01', 
          amount: 10000 
        };

        mockAxiosInstance.post.mockResolvedValue({ 
          data: { deal: mockDeal } 
        });

        const dealData = {
          issue_date: '2024-01-01',
          type: 'income' as const,
          amount: 10000,
          status: 'settled',
          details: [{
            amount: 10000,
            account_item_id: 1,
            tax_code: 1
          }]
        };

        const result = await client.createDeal(123, dealData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/deals', {
          company_id: 123,
          ...dealData
        });
        expect(result).toEqual(mockDeal);
      });
    });

    describe('getInvoices', () => {
      it('should fetch invoices with parameters', async () => {
        const mockInvoices = [
          { id: 1, issue_date: '2024-01-01', total_amount: 10000 }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { invoices: mockInvoices } 
        });

        const params = {
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-01-31'
        };

        const result = await client.getInvoices(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/invoices', { 
          params: { company_id: 123, ...params } 
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
          balances: []
        };

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { trial_pl: mockReport } 
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12
        };

        const result = await client.getProfitLoss(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/reports/trial_pl', { 
          params: { company_id: 123, ...params } 
        });
        expect(result).toEqual(mockReport);
      });

      it('should fetch balance sheet report', async () => {
        const mockReport = {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          created_at: '2024-01-01',
          balances: []
        };

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { trial_bs: mockReport } 
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12
        };

        const result = await client.getBalanceSheet(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/reports/trial_bs', { 
          params: { company_id: 123, ...params } 
        });
        expect(result).toEqual(mockReport);
      });

      it('should fetch trial balance report', async () => {
        const mockReport = {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          created_at: '2024-01-01',
          balances: []
        };

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { trial_bs: mockReport } 
        });

        const params = {
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12
        };

        const result = await client.getTrialBalance(123, params);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/reports/trial_bs', { 
          params: { company_id: 123, ...params } 
        });
        expect(result).toEqual(mockReport);
      });
    });

    describe('master data methods', () => {
      it('should fetch account items', async () => {
        const mockItems = [
          { id: 1, name: 'Sales', account_category: 'income' }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { account_items: mockItems } 
        });

        const result = await client.getAccountItems(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/account_items', { 
          params: { company_id: 123 } 
        });
        expect(result).toEqual(mockItems);
      });

      it('should fetch partners', async () => {
        const mockPartners = [
          { id: 1, company_id: 123, name: 'Partner 1', available: true }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { partners: mockPartners } 
        });

        const result = await client.getPartners(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/partners', { 
          params: { company_id: 123 } 
        });
        expect(result).toEqual(mockPartners);
      });

      it('should fetch sections', async () => {
        const mockSections = [
          { id: 1, company_id: 123, name: 'Section 1', available: true }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { sections: mockSections } 
        });

        const result = await client.getSections(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sections', { 
          params: { company_id: 123 } 
        });
        expect(result).toEqual(mockSections);
      });

      it('should fetch tags', async () => {
        const mockTags = [
          { id: 1, name: 'Tag 1' }
        ];

        mockAxiosInstance.get.mockResolvedValue({ 
          data: { tags: mockTags } 
        });

        const result = await client.getTags(123);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tags', { 
          params: { company_id: 123 } 
        });
        expect(result).toEqual(mockTags);
      });
    });

    describe('authentication methods', () => {
      it('should generate authorization URL', () => {
        const url = client.getAuthorizationUrl('test-state');
        expect(url).toContain('https://accounts.secure.freee.co.jp/public_api/authorize');
        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('redirect_uri=test-redirect-uri');
        expect(url).toContain('response_type=code');
        expect(url).toContain('state=test-state');
      });

      it('should exchange authorization code for token', async () => {
        const mockTokenResponse = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 21600
        };

        mockAuthAxiosInstance.post.mockResolvedValue({
          data: mockTokenResponse
        });

        const result = await client.getAccessToken('test-code');

        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('grant_type=authorization_code')
        );
        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('code=test-code')
        );
        expect(result).toEqual(mockTokenResponse);
      });

      it('should refresh access token', async () => {
        const mockTokenResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 21600
        };

        mockAuthAxiosInstance.post.mockResolvedValue({
          data: mockTokenResponse
        });

        await client.refreshToken(123, 'old-refresh-token');

        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('grant_type=refresh_token')
        );
        expect(mockAuthAxiosInstance.post).toHaveBeenCalledWith(
          '/public_api/token',
          expect.stringContaining('refresh_token=old-refresh-token')
        );
        expect(mockTokenManager.setToken).toHaveBeenCalledWith(123, mockTokenResponse);
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors with error message', async () => {
      // We need to trigger the error handler in the response interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      const error = {
        response: {
          status: 400,
          data: {
            errors: [{
              messages: ['Invalid request parameters']
            }]
          }
        },
        config: {}
      };

      await expect(errorHandler(error)).rejects.toThrow('freee API Error: Invalid request parameters');
    });

    it('should handle API errors without message', async () => {
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      const error = {
        response: {
          status: 400
        },
        message: 'Network error',
        config: {}
      };

      await expect(errorHandler(error)).rejects.toThrow('freee API Error: Network error');
    });
  });

  describe('interceptors', () => {
    it('should add authorization header in request interceptor', async () => {
      const mockToken = { access_token: 'test-token' };
      mockTokenManager.getToken.mockReturnValue(mockToken);
      mockTokenManager.getTokenExpiryStatus.mockReturnValue({ status: 'valid', remainingMinutes: 300 });

      // Get the request interceptor
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        params: { company_id: 123 }
      };

      const result = await requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
      expect(mockTokenManager.getToken).toHaveBeenCalledWith(123);
    });

    it('should handle 401 errors in response interceptor', async () => {
      const mockOldToken = { 
        access_token: 'old-token',
        refresh_token: 'refresh-token'
      };
      
      mockTokenManager.getToken.mockReturnValue(mockOldToken);
      mockTokenManager.getAllCompanyIds.mockReturnValue([123]);
      
      // Mock refreshToken to succeed
      (client as any).refreshToken = jest.fn() as any;

      // Get the error handler from response interceptor
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const originalRequest = {
        params: { company_id: 123 },
        headers: {}
      };

      const error = {
        config: originalRequest,
        response: { status: 401 }
      };

      // Mock the retry request
      mockAxiosInstance.request.mockResolvedValue({ data: 'success' });

      const result = await errorHandler(error);

      expect((client as any).refreshToken).toHaveBeenCalledWith(123, 'refresh-token');
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(originalRequest);
      expect(result).toEqual({ data: 'success' });
    });
  });
});