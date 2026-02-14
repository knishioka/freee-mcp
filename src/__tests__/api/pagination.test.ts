import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

describe('FreeeClient - Auto-pagination and Aggregation', () => {
  let client: FreeeClient;
  let mockAxiosInstance: any;
  let mockTokenManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    const mockAuthAxiosInstance = { post: jest.fn() };

    let createCallCount = 0;
    mockedAxios.create.mockImplementation(() => {
      createCallCount++;
      return createCallCount === 1 ? mockAxiosInstance : mockAuthAxiosInstance;
    });

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

  describe('fetchAllPages', () => {
    it('should fetch a single page when results < limit', async () => {
      const mockDeals = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        issue_date: '2024-01-01',
        amount: 1000,
      }));

      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: mockDeals },
      });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
      );

      expect(result).toHaveLength(50);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/deals', {
        params: { company_id: 123, offset: 0, limit: 100 },
      });
    });

    it('should fetch multiple pages until last page', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const page2 = Array.from({ length: 100 }, (_, i) => ({ id: i + 101 }));
      const page3 = Array.from({ length: 30 }, (_, i) => ({ id: i + 201 }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { deals: page1 } })
        .mockResolvedValueOnce({ data: { deals: page2 } })
        .mockResolvedValueOnce({ data: { deals: page3 } });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
      );

      expect(result).toHaveLength(230);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/deals', {
        params: { company_id: 123, offset: 0, limit: 100 },
      });
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/deals', {
        params: { company_id: 123, offset: 100, limit: 100 },
      });
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(3, '/deals', {
        params: { company_id: 123, offset: 200, limit: 100 },
      });
    });

    it('should handle empty results', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: [] },
      });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
      );

      expect(result).toHaveLength(0);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should handle exactly 100 results (boundary case)', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { deals: page1 } })
        .mockResolvedValueOnce({ data: { deals: [] } });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
      );

      expect(result).toHaveLength(100);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should respect maxRecords limit', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const page2 = Array.from({ length: 100 }, (_, i) => ({ id: i + 101 }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { deals: page1 } })
        .mockResolvedValueOnce({ data: { deals: page2 } });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
        150,
      );

      expect(result).toHaveLength(150);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle missing data key gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {},
      });

      const result = await client.fetchAllPages(
        '/deals',
        { company_id: 123 },
        'deals',
      );

      expect(result).toHaveLength(0);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchDeals', () => {
    it('should aggregate deals by partner, month, and account item', async () => {
      const mockDeals = [
        {
          id: 1,
          company_id: 123,
          issue_date: '2024-01-15',
          amount: 10000,
          type: 'income',
          partner_id: 1,
          partner_name: 'Partner A',
          status: 'settled',
          details: [{ account_item_id: 100, tax_code: 1, amount: 10000 }],
        },
        {
          id: 2,
          company_id: 123,
          issue_date: '2024-01-20',
          amount: 5000,
          type: 'expense',
          partner_id: 2,
          partner_name: 'Partner B',
          status: 'settled',
          details: [{ account_item_id: 200, tax_code: 1, amount: 5000 }],
        },
        {
          id: 3,
          company_id: 123,
          issue_date: '2024-02-10',
          amount: 8000,
          type: 'income',
          partner_id: 1,
          partner_name: 'Partner A',
          status: 'settled',
          details: [{ account_item_id: 100, tax_code: 1, amount: 8000 }],
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: mockDeals },
      });

      const result = await client.searchDeals(123, {
        start_issue_date: '2024-01-01',
        end_issue_date: '2024-02-28',
      });

      expect(result.total_count).toBe(3);
      expect(result.total_income).toBe(18000);
      expect(result.total_expense).toBe(5000);
      expect(result.date_range).toBe('2024-01-15 to 2024-02-10');

      // By partner
      expect(result.by_partner).toHaveLength(2);
      const partnerA = result.by_partner.find((p) => p.partner_id === 1);
      expect(partnerA).toEqual({
        partner_id: 1,
        partner_name: 'Partner A',
        income: 18000,
        expense: 0,
        count: 2,
      });

      // By month
      expect(result.by_month).toHaveLength(2);
      expect(result.by_month[0]).toEqual({
        month: '2024-01',
        income: 10000,
        expense: 5000,
        count: 2,
      });
      expect(result.by_month[1]).toEqual({
        month: '2024-02',
        income: 8000,
        expense: 0,
        count: 1,
      });

      // By account item
      expect(result.by_account_item).toHaveLength(2);
      const accountItem100 = result.by_account_item.find(
        (a) => a.account_item_id === 100,
      );
      expect(accountItem100).toEqual({
        account_item_id: 100,
        total: 18000,
        count: 2,
      });
    });

    it('should handle empty deals', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: [] },
      });

      const result = await client.searchDeals(123, {});

      expect(result.total_count).toBe(0);
      expect(result.total_income).toBe(0);
      expect(result.total_expense).toBe(0);
      expect(result.date_range).toBeUndefined();
      expect(result.by_partner).toEqual([]);
      expect(result.by_month).toEqual([]);
      expect(result.by_account_item).toEqual([]);
    });

    it('should handle deals without partners', async () => {
      const mockDeals = [
        {
          id: 1,
          company_id: 123,
          issue_date: '2024-01-15',
          amount: 10000,
          type: 'income',
          status: 'settled',
          details: [],
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: mockDeals },
      });

      const result = await client.searchDeals(123, {});

      expect(result.total_count).toBe(1);
      expect(result.by_partner).toEqual([]);
    });

    it('should pass filter parameters correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { deals: [] },
      });

      await client.searchDeals(123, {
        partner_id: 1,
        account_item_id: 100,
        start_issue_date: '2024-01-01',
        end_issue_date: '2024-12-31',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/deals', {
        params: {
          company_id: 123,
          partner_id: 1,
          account_item_id: 100,
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-12-31',
          offset: 0,
          limit: 100,
        },
      });
    });

    it('should pass maxRecords to fetchAllPages', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        company_id: 123,
        issue_date: '2024-01-01',
        amount: 1000,
        type: 'income' as const,
        status: 'settled',
        details: [],
      }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { deals: page1 } })
        .mockResolvedValueOnce({ data: { deals: [] } });

      const result = await client.searchDeals(123, {}, 50);

      expect(result.total_count).toBe(50);
    });
  });

  describe('summarizeInvoices', () => {
    it('should aggregate invoices by status and partner', async () => {
      const mockInvoices = [
        {
          id: 1,
          company_id: 123,
          issue_date: '2024-01-15',
          partner_id: 1,
          partner_name: 'Client A',
          invoice_number: 'INV-001',
          total_amount: 50000,
          invoice_status: 'sent',
          payment_status: 'unsettled',
          due_date: '2024-02-15',
          invoice_lines: [],
        },
        {
          id: 2,
          company_id: 123,
          issue_date: '2024-01-20',
          partner_id: 2,
          partner_name: 'Client B',
          invoice_number: 'INV-002',
          total_amount: 30000,
          invoice_status: 'settled',
          payment_status: 'settled',
          due_date: '2024-02-20',
          invoice_lines: [],
        },
        {
          id: 3,
          company_id: 123,
          issue_date: '2024-02-01',
          partner_id: 1,
          partner_name: 'Client A',
          invoice_number: 'INV-003',
          total_amount: 20000,
          invoice_status: 'sent',
          payment_status: 'unsettled',
          due_date: '2024-03-01',
          invoice_lines: [],
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { invoices: mockInvoices },
      });

      const result = await client.summarizeInvoices(123, {});

      expect(result.total_count).toBe(3);
      expect(result.total_amount).toBe(100000);
      expect(result.unpaid_amount).toBe(70000);
      expect(result.date_range).toBe('2024-01-15 to 2024-02-01');

      // By status
      expect(result.by_status).toHaveLength(2);
      const sentUnsettled = result.by_status.find(
        (s) => s.status === 'sent/unsettled',
      );
      expect(sentUnsettled).toEqual({
        status: 'sent/unsettled',
        count: 2,
        amount: 70000,
      });

      // By partner
      expect(result.by_partner).toHaveLength(2);
      const clientA = result.by_partner.find((p) => p.partner_id === 1);
      expect(clientA).toEqual({
        partner_id: 1,
        partner_name: 'Client A',
        count: 2,
        amount: 70000,
        unpaid: 70000,
      });
    });

    it('should detect overdue invoices', async () => {
      const pastDate = '2020-01-01';
      const mockInvoices = [
        {
          id: 1,
          company_id: 123,
          issue_date: '2019-12-01',
          partner_id: 1,
          partner_name: 'Client A',
          invoice_number: 'INV-001',
          total_amount: 50000,
          invoice_status: 'sent',
          payment_status: 'unsettled',
          due_date: pastDate,
          invoice_lines: [],
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { invoices: mockInvoices },
      });

      const result = await client.summarizeInvoices(123, {});

      expect(result.overdue_count).toBe(1);
      expect(result.unpaid_amount).toBe(50000);
    });

    it('should handle empty invoices', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { invoices: [] },
      });

      const result = await client.summarizeInvoices(123, {});

      expect(result.total_count).toBe(0);
      expect(result.total_amount).toBe(0);
      expect(result.unpaid_amount).toBe(0);
      expect(result.overdue_count).toBe(0);
      expect(result.date_range).toBeUndefined();
      expect(result.by_status).toEqual([]);
      expect(result.by_partner).toEqual([]);
    });

    it('should pass filter parameters correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { invoices: [] },
      });

      await client.summarizeInvoices(123, {
        partner_id: 1,
        invoice_status: 'sent',
        payment_status: 'unsettled',
        start_issue_date: '2024-01-01',
        end_issue_date: '2024-12-31',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/invoices', {
        params: {
          company_id: 123,
          partner_id: 1,
          invoice_status: 'sent',
          payment_status: 'unsettled',
          start_issue_date: '2024-01-01',
          end_issue_date: '2024-12-31',
          offset: 0,
          limit: 100,
        },
      });
    });

    it('should handle invoices with empty payment_status', async () => {
      const mockInvoices = [
        {
          id: 1,
          company_id: 123,
          issue_date: '2024-01-15',
          partner_id: 1,
          partner_name: 'Client A',
          invoice_number: 'INV-001',
          total_amount: 50000,
          invoice_status: 'draft',
          payment_status: 'empty',
          invoice_lines: [],
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { invoices: mockInvoices },
      });

      const result = await client.summarizeInvoices(123, {});

      expect(result.unpaid_amount).toBe(50000);
    });
  });
});
