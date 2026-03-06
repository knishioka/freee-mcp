import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

describe('FreeeClient Journal Consistency Check', () => {
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

  function mockResponses(
    deals: Record<string, unknown>[],
    accountItems: Record<string, unknown>[] = [
      { id: 10, company_id: 1, name: '通信費', available: true },
      { id: 20, company_id: 1, name: 'ソフトウェア使用料', available: true },
      { id: 30, company_id: 1, name: '広告宣伝費', available: true },
    ],
  ) {
    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === '/deals') {
        return Promise.resolve({
          data: { deals, meta: { total_count: deals.length } },
        });
      }
      if (url === '/account_items') {
        return Promise.resolve({ data: { account_items: accountItems } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  }

  it('should detect account item inconsistencies per partner', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000 }],
      },
      {
        id: 3,
        company_id: 1,
        issue_date: '2024-03-15',
        amount: 3000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 20, tax_code: 1, amount: 3000 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });

    expect(result.total_deals).toBe(3);
    expect(result.account_item_inconsistencies).toHaveLength(1);
    expect(result.account_item_inconsistencies[0].partner_name).toBe(
      'Figma Inc',
    );
    expect(result.account_item_inconsistencies[0].account_items).toHaveLength(
      2,
    );
    expect(
      result.account_item_inconsistencies[0].account_items[0].account_item_name,
    ).toBe('通信費');
    expect(result.account_item_inconsistencies[0].account_items[0].count).toBe(
      2,
    );
    expect(
      result.account_item_inconsistencies[0].account_items[1].account_item_name,
    ).toBe('ソフトウェア使用料');
    expect(result.account_item_inconsistencies[0].account_items[1].count).toBe(
      1,
    );
    expect(result.account_item_inconsistencies[0].recommendation).toContain(
      '通信費',
    );
  });

  it('should detect tax category inconsistencies', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 2, amount: 1000 }],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 2, amount: 2000 }],
      },
      {
        id: 3,
        company_id: 1,
        issue_date: '2024-03-15',
        amount: 3000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Figma Inc',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 8, amount: 3000 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    expect(result.tax_category_inconsistencies).toHaveLength(1);
    expect(result.tax_category_inconsistencies[0].partner_name).toBe(
      'Figma Inc',
    );
    expect(result.tax_category_inconsistencies[0].account_item_name).toBe(
      '通信費',
    );
    expect(result.tax_category_inconsistencies[0].tax_patterns).toHaveLength(2);
    expect(
      result.tax_category_inconsistencies[0].tax_patterns[0].tax_code,
    ).toBe(2);
    expect(result.tax_category_inconsistencies[0].tax_patterns[0].count).toBe(
      2,
    );
    expect(
      result.tax_category_inconsistencies[0].tax_patterns[1].tax_code,
    ).toBe(8);
  });

  it('should count consistent partners', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'AWS',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'AWS',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    expect(result.account_item_inconsistencies).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(1);
  });

  it('should return clean result when no issues found', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'AWS',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    expect(result.account_item_inconsistencies).toHaveLength(0);
    expect(result.tax_category_inconsistencies).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(1);
    expect(result.summary).toContain('問題なし');
  });

  it('should build correct period label', async () => {
    mockResponses([]);

    const result1 = await client.checkJournalConsistency(1, {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });
    expect(result1.period).toBe('2024-01-01 ~ 2024-12-31');

    const result2 = await client.checkJournalConsistency(1, {});
    expect(result2.period).toBe('all');
  });

  it('should pass date filters to fetchAllPages', async () => {
    mockResponses([]);

    await client.checkJournalConsistency(1, {
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

  it('should skip deals without partner_id', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    expect(result.total_deals).toBe(1);
    expect(result.account_item_inconsistencies).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(0);
  });

  it('should sort account item inconsistencies by dispersion', async () => {
    const deals = [
      // Partner A: 3 different account items (most dispersed)
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Partner A',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Partner A',
        status: 'settled',
        details: [{ account_item_id: 20, tax_code: 1, amount: 2000 }],
      },
      {
        id: 3,
        company_id: 1,
        issue_date: '2024-03-15',
        amount: 3000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Partner A',
        status: 'settled',
        details: [{ account_item_id: 30, tax_code: 1, amount: 3000 }],
      },
      // Partner B: 2 different account items
      {
        id: 4,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 500,
        type: 'expense',
        partner_id: 200,
        partner_name: 'Partner B',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 500 }],
      },
      {
        id: 5,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 800,
        type: 'expense',
        partner_id: 200,
        partner_name: 'Partner B',
        status: 'settled',
        details: [{ account_item_id: 20, tax_code: 1, amount: 800 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    expect(result.account_item_inconsistencies).toHaveLength(2);
    // Partner A should come first (3 account items > 2)
    expect(result.account_item_inconsistencies[0].partner_name).toBe(
      'Partner A',
    );
    expect(result.account_item_inconsistencies[0].account_items).toHaveLength(
      3,
    );
    expect(result.account_item_inconsistencies[1].partner_name).toBe(
      'Partner B',
    );
    expect(result.account_item_inconsistencies[1].account_items).toHaveLength(
      2,
    );
  });

  it('should track total_amount per account item', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Test',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Test',
        status: 'settled',
        details: [{ account_item_id: 10, tax_code: 1, amount: 2000 }],
      },
      {
        id: 3,
        company_id: 1,
        issue_date: '2024-03-15',
        amount: 500,
        type: 'expense',
        partner_id: 100,
        partner_name: 'Test',
        status: 'settled',
        details: [{ account_item_id: 20, tax_code: 1, amount: 500 }],
      },
    ];

    mockResponses(deals);

    const result = await client.checkJournalConsistency(1, {});

    const inconsistency = result.account_item_inconsistencies[0];
    expect(inconsistency.account_items[0].total_amount).toBe(3000);
    expect(inconsistency.account_items[1].total_amount).toBe(500);
  });
});
