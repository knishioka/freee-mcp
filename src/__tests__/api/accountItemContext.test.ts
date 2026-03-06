import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

const mockDeals = [
  {
    id: 1,
    company_id: 123,
    issue_date: '2025-11-15',
    amount: 150000,
    type: 'expense',
    partner_id: 10,
    partner_name: 'AWS',
    status: 'settled',
    details: [{ account_item_id: 101, tax_code: 21, amount: 150000 }],
  },
  {
    id: 2,
    company_id: 123,
    issue_date: '2025-10-20',
    amount: 120000,
    type: 'expense',
    partner_id: 10,
    partner_name: 'AWS',
    status: 'settled',
    details: [{ account_item_id: 101, tax_code: 21, amount: 120000 }],
  },
  {
    id: 3,
    company_id: 123,
    issue_date: '2025-09-01',
    amount: 50000,
    type: 'expense',
    partner_id: 10,
    partner_name: 'AWS',
    status: 'settled',
    details: [{ account_item_id: 205, tax_code: 21, amount: 50000 }],
  },
];

const mockAccountItems = [
  {
    id: 101,
    company_id: 123,
    name: '通信費',
    account_category: 'expense',
    tax_code: 21,
    available: true,
  },
  {
    id: 205,
    company_id: 123,
    name: 'ソフトウェア使用料',
    account_category: 'expense',
    tax_code: 21,
    available: true,
  },
  {
    id: 300,
    company_id: 123,
    name: '売上高',
    account_category: 'income',
    tax_code: 1,
    available: true,
  },
  {
    id: 400,
    company_id: 123,
    name: '未使用科目',
    account_category: 'expense',
    tax_code: 21,
    available: false,
  },
];

const mockTaxCodes = [
  { code: 21, name: 'tax_10', name_ja: '課税10%' },
  { code: 1, name: 'tax_exempt', name_ja: '非課税' },
];

describe('FreeeClient.getAccountItemContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  it('returns candidates sorted by usage_count when partner_id is provided', async () => {
    // Promise.all concurrency: fetchAllPages, getAccountItems, getTaxCodes
    // Each starts and hits its first await, consuming mocks in order
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { deals: mockDeals } }) // fetchAllPages page 1
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } }) // getAccountItems
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } }) // getTaxCodes
      .mockResolvedValueOnce({ data: { deals: [] } }); // fetchAllPages page 2 (end)

    const result = await client.getAccountItemContext(123, {
      description: 'AWS利用料',
      partner_id: 10,
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].account_item_name).toBe('通信費');
    expect(result.candidates[0].usage_count).toBe(2);
    expect(result.candidates[0].tax_name).toBe('課税10%');
    expect(result.candidates[1].account_item_name).toBe('ソフトウェア使用料');
    expect(result.candidates[1].usage_count).toBe(1);
  });

  it('returns similar_deals when amount is provided', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { deals: mockDeals } })
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } })
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } })
      .mockResolvedValueOnce({ data: { deals: [] } });

    const result = await client.getAccountItemContext(123, {
      description: 'AWS利用料',
      partner_id: 10,
      amount: 130000,
    });

    // 130000 * 0.5 = 65000, 130000 * 1.5 = 195000
    // Deals with amounts 150000 and 120000 should match
    expect(result.similar_deals).toHaveLength(2);
    expect(result.similar_deals[0].date).toBe('2025-11-15');
    expect(result.similar_deals[0].amount).toBe(150000);
  });

  it('returns all_account_items with tax info (excludes unavailable)', async () => {
    // No deals needed for description-only mode
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } })
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } });

    const result = await client.getAccountItemContext(123, {
      description: 'テスト',
    });

    // Should not include the unavailable item
    expect(result.all_account_items).toHaveLength(3);
    expect(result.all_account_items.find((a) => a.id === 400)).toBeUndefined();
    expect(result.all_account_items[0].tax_name).toBe('課税10%');
  });

  it('works with description only (no partner, no amount)', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } })
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } });

    const result = await client.getAccountItemContext(123, {
      description: 'オフィス家賃',
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.similar_deals).toHaveLength(0);
    expect(result.all_account_items.length).toBeGreaterThan(0);
  });

  it('filters deals by partner_name when partner_id is not provided', async () => {
    const mixedDeals = [
      ...mockDeals,
      {
        id: 4,
        company_id: 123,
        issue_date: '2025-08-01',
        amount: 80000,
        type: 'expense',
        partner_id: 20,
        partner_name: 'Google Cloud',
        status: 'settled',
        details: [{ account_item_id: 300, tax_code: 1, amount: 80000 }],
      },
    ];

    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { deals: mixedDeals } })
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } })
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } })
      .mockResolvedValueOnce({ data: { deals: [] } });

    const result = await client.getAccountItemContext(123, {
      description: 'AWS費用',
      partner_name: 'AWS',
    });

    // Should only include candidates from AWS deals, not Google Cloud
    const candidateNames = result.candidates.map((c) => c.account_item_name);
    expect(candidateNames).toContain('通信費');
    expect(candidateNames).not.toContain('売上高');
  });

  it('includes last_used in YYYY-MM format', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce({ data: { deals: mockDeals } })
      .mockResolvedValueOnce({ data: { account_items: mockAccountItems } })
      .mockResolvedValueOnce({ data: { taxes: mockTaxCodes } })
      .mockResolvedValueOnce({ data: { deals: [] } });

    const result = await client.getAccountItemContext(123, {
      description: 'AWS',
      partner_id: 10,
    });

    expect(result.candidates[0].last_used).toBe('2025-11');
  });
});
