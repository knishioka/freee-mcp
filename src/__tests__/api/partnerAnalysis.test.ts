import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

describe('FreeeClient Partner Analysis', () => {
  let client: FreeeClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAxiosInstance: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  function mockDeals(deals: Record<string, unknown>[]) {
    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === '/deals') {
        return Promise.resolve({
          data: { deals, meta: { total_count: deals.length } },
        });
      }
      return Promise.resolve({ data: {} });
    });
  }

  const baseDeal = {
    company_id: 1,
    due_date: null,
    ref_number: null,
    status: 'settled',
    details: [{ account_item_id: 10, tax_code: 1, amount: 0 }],
  };

  it('should aggregate deals by partner for income and expense', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-15',
        amount: 5000000,
        type: 'income',
        partner_id: 100,
        partner_name: 'A社',
        details: [{ account_item_id: 10, tax_code: 1, amount: 5000000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-05-10',
        amount: 3000000,
        type: 'income',
        partner_id: 200,
        partner_name: 'B社',
        details: [{ account_item_id: 10, tax_code: 1, amount: 3000000 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-20',
        amount: 2000000,
        type: 'income',
        partner_id: 300,
        partner_name: 'C社',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000000 }],
      },
      {
        ...baseDeal,
        id: 4,
        issue_date: '2024-04-25',
        amount: 1000000,
        type: 'expense',
        partner_id: 400,
        partner_name: 'D社',
        details: [{ account_item_id: 20, tax_code: 1, amount: 1000000 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});

    expect(result.analysis_type).toBe('all');
    expect(result.total_income).toBe(10000000);
    expect(result.total_expense).toBe(1000000);
    expect(result.income_partners).toHaveLength(3);
    expect(result.expense_partners).toHaveLength(1);

    // Sorted by amount descending
    expect(result.income_partners[0].partner_name).toBe('A社');
    expect(result.income_partners[0].amount).toBe(5000000);
    expect(result.income_partners[0].share).toBe(50);
    expect(result.income_partners[0].rank).toBe(1);

    expect(result.income_partners[1].partner_name).toBe('B社');
    expect(result.income_partners[1].amount).toBe(3000000);
    expect(result.income_partners[1].share).toBe(30);
  });

  it('should compute concentration risk levels', async () => {
    // 3 partners: 70%, 20%, 10% → top3 = 100% → high
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 7000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 7000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 2000,
        type: 'income',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-01',
        amount: 1000,
        type: 'income',
        partner_id: 3,
        partner_name: 'P3',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});
    expect(result.income_concentration.top3_share).toBe(100);
    expect(result.income_concentration.level).toBe('high');
  });

  it('should return medium concentration for top3 between 50-70%', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 200,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 200 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 150,
        type: 'income',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 10, tax_code: 1, amount: 150 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-01',
        amount: 150,
        type: 'income',
        partner_id: 3,
        partner_name: 'P3',
        details: [{ account_item_id: 10, tax_code: 1, amount: 150 }],
      },
      {
        ...baseDeal,
        id: 4,
        issue_date: '2024-04-01',
        amount: 150,
        type: 'income',
        partner_id: 4,
        partner_name: 'P4',
        details: [{ account_item_id: 10, tax_code: 1, amount: 150 }],
      },
      {
        ...baseDeal,
        id: 5,
        issue_date: '2024-04-01',
        amount: 150,
        type: 'income',
        partner_id: 5,
        partner_name: 'P5',
        details: [{ account_item_id: 10, tax_code: 1, amount: 150 }],
      },
      {
        ...baseDeal,
        id: 6,
        issue_date: '2024-04-01',
        amount: 200,
        type: 'income',
        partner_id: 6,
        partner_name: 'P6',
        details: [{ account_item_id: 10, tax_code: 1, amount: 200 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});
    // Top 3: 200 + 200 + 150 = 550 / 1000 = 55%
    expect(result.income_concentration.top3_share).toBe(55);
    expect(result.income_concentration.level).toBe('medium');
  });

  it('should return low concentration when top3 < 50%', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 3,
        partner_name: 'P3',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 4,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 4,
        partner_name: 'P4',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 5,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 5,
        partner_name: 'P5',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 6,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 6,
        partner_name: 'P6',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
      {
        ...baseDeal,
        id: 7,
        issue_date: '2024-04-01',
        amount: 100,
        type: 'income',
        partner_id: 7,
        partner_name: 'P7',
        details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});
    // Top 3: 300 / 700 = ~42.86%
    expect(result.income_concentration.top3_share).toBeCloseTo(42.86, 1);
    expect(result.income_concentration.level).toBe('low');
  });

  it('should respect topN parameter', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 500,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 500 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 300,
        type: 'income',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 10, tax_code: 1, amount: 300 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-01',
        amount: 200,
        type: 'income',
        partner_id: 3,
        partner_name: 'P3',
        details: [{ account_item_id: 10, tax_code: 1, amount: 200 }],
      },
    ]);

    const result = await client.analyzePartners(1, { top_n: 2 });
    expect(result.income_partners).toHaveLength(2);
    expect(result.income_partners[0].partner_name).toBe('P1');
    expect(result.income_partners[1].partner_name).toBe('P2');
  });

  it('should filter by type=income', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 1000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 500,
        type: 'expense',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 20, tax_code: 1, amount: 500 }],
      },
    ]);

    const result = await client.analyzePartners(1, { type: 'income' });
    expect(result.analysis_type).toBe('income');
    expect(result.income_partners).toHaveLength(1);
    expect(result.expense_partners).toHaveLength(0);
    expect(result.expense_concentration.level).toBe('low');
    expect(result.expense_concentration.top3_share).toBe(0);
  });

  it('should filter by type=expense', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 1000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 500,
        type: 'expense',
        partner_id: 2,
        partner_name: 'P2',
        details: [{ account_item_id: 20, tax_code: 1, amount: 500 }],
      },
    ]);

    const result = await client.analyzePartners(1, { type: 'expense' });
    expect(result.analysis_type).toBe('expense');
    expect(result.income_partners).toHaveLength(0);
    expect(result.expense_partners).toHaveLength(1);
    expect(result.income_concentration.level).toBe('low');
    expect(result.income_concentration.top3_share).toBe(0);
  });

  it('should include monthly breakdown per partner', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-15',
        amount: 3000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 3000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-05-10',
        amount: 2000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000 }],
      },
      {
        ...baseDeal,
        id: 3,
        issue_date: '2024-04-20',
        amount: 1000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});
    expect(result.income_partners).toHaveLength(1);
    const partner = result.income_partners[0];
    expect(partner.amount).toBe(6000);
    expect(partner.monthly_breakdown).toHaveLength(2);
    expect(partner.monthly_breakdown[0]).toEqual({
      month: '2024-04',
      amount: 4000,
    });
    expect(partner.monthly_breakdown[1]).toEqual({
      month: '2024-05',
      amount: 2000,
    });
  });

  it('should skip deals without partner_id', async () => {
    mockDeals([
      {
        ...baseDeal,
        id: 1,
        issue_date: '2024-04-01',
        amount: 1000,
        type: 'income',
        partner_id: 1,
        partner_name: 'P1',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        ...baseDeal,
        id: 2,
        issue_date: '2024-04-01',
        amount: 500,
        type: 'income',
        details: [{ account_item_id: 10, tax_code: 1, amount: 500 }],
      },
    ]);

    const result = await client.analyzePartners(1, {});
    expect(result.total_income).toBe(1000);
    expect(result.income_partners).toHaveLength(1);
  });

  it('should handle empty deals', async () => {
    mockDeals([]);

    const result = await client.analyzePartners(1, {});
    expect(result.total_income).toBe(0);
    expect(result.total_expense).toBe(0);
    expect(result.income_partners).toHaveLength(0);
    expect(result.expense_partners).toHaveLength(0);
    expect(result.income_concentration.level).toBe('low');
    expect(result.truncated).toBe(false);
  });

  it('should set truncated flag when deals reach maxRecords', async () => {
    const deals = Array.from({ length: 100 }, (_, i) => ({
      ...baseDeal,
      id: i + 1,
      issue_date: '2024-04-01',
      amount: 100,
      type: 'income',
      partner_id: 1,
      partner_name: 'P1',
      details: [{ account_item_id: 10, tax_code: 1, amount: 100 }],
    }));

    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === '/deals') {
        return Promise.resolve({
          data: { deals, meta: { total_count: 200 } },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const result = await client.analyzePartners(1, { max_records: 100 });
    expect(result.truncated).toBe(true);
    expect(result.max_records_cap).toBe(100);
  });

  it('should include date_range when dates are provided', async () => {
    mockDeals([]);

    const result = await client.analyzePartners(1, {
      start_date: '2024-04-01',
      end_date: '2024-06-30',
    });
    expect(result.date_range).toBe('2024-04-01 ~ 2024-06-30');
  });

  it('should pass date params to API call', async () => {
    mockDeals([]);

    await client.analyzePartners(1, {
      start_date: '2024-04-01',
      end_date: '2024-06-30',
    });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/deals',
      expect.objectContaining({
        params: expect.objectContaining({
          company_id: 1,
          start_issue_date: '2024-04-01',
          end_issue_date: '2024-06-30',
        }),
      }),
    );
  });
});
