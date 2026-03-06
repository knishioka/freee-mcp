import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

describe('FreeeClient Tagging Consistency Check', () => {
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
    tags: Record<string, unknown>[],
    accountItems: Record<string, unknown>[] = [
      { id: 10, company_id: 1, name: '通信費' },
      { id: 50, company_id: 1, name: 'サーバー費用' },
    ],
  ) {
    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === '/deals') {
        return Promise.resolve({
          data: { deals, meta: { total_count: deals.length } },
        });
      }
      if (url === '/tags') {
        return Promise.resolve({ data: { tags } });
      }
      if (url === '/account_items') {
        return Promise.resolve({ data: { account_items: accountItems } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  }

  it('should detect tag inconsistencies per partner', async () => {
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
        details: [
          { account_item_id: 10, tax_code: 1, amount: 1000, tag_ids: [1] },
        ],
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
        details: [
          { account_item_id: 10, tax_code: 1, amount: 2000 }, // no tags
        ],
      },
    ];

    const tags = [{ id: 1, company_id: 1, name: 'infra', available: true }];

    mockResponses(deals, tags);

    const result = await client.checkTaggingConsistency(1, {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });

    expect(result.total_deals).toBe(2);
    expect(result.tag_inconsistencies).toHaveLength(1);
    expect(result.tag_inconsistencies[0].partner_name).toBe('AWS');
    expect(result.tag_inconsistencies[0].tagged_deals).toBe(1);
    expect(result.tag_inconsistencies[0].untagged_deals).toBe(1);
    expect(result.tag_inconsistencies[0].tag_patterns).toHaveLength(1);
    expect(result.tag_inconsistencies[0].tag_patterns[0].tag_names).toEqual([
      'infra',
    ]);
  });

  it('should detect multiple tag patterns per partner', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 200,
        partner_name: 'Google Cloud',
        status: 'settled',
        details: [
          { account_item_id: 10, tax_code: 1, amount: 1000, tag_ids: [1] },
        ],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 200,
        partner_name: 'Google Cloud',
        status: 'settled',
        details: [
          { account_item_id: 10, tax_code: 1, amount: 2000, tag_ids: [2] },
        ],
      },
    ];

    const tags = [
      { id: 1, company_id: 1, name: 'infra', available: true },
      { id: 2, company_id: 1, name: 'dev', available: true },
    ];

    mockResponses(deals, tags);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.tag_inconsistencies).toHaveLength(1);
    expect(result.tag_inconsistencies[0].partner_name).toBe('Google Cloud');
    expect(result.tag_inconsistencies[0].tag_patterns).toHaveLength(2);
    expect(result.consistent_partner_count).toBe(0);
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
        details: [
          { account_item_id: 10, tax_code: 1, amount: 1000, tag_ids: [1] },
        ],
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
        details: [
          { account_item_id: 10, tax_code: 1, amount: 2000, tag_ids: [1] },
        ],
      },
    ];

    const tags = [{ id: 1, company_id: 1, name: 'infra', available: true }];

    mockResponses(deals, tags);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.tag_inconsistencies).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(1);
  });

  it('should detect segment gaps (missing section_id)', async () => {
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
        details: [
          { account_item_id: 10, tax_code: 1, amount: 1000, section_id: 1 },
        ],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 200,
        partner_name: 'GCP',
        status: 'settled',
        details: [
          { account_item_id: 10, tax_code: 1, amount: 2000 }, // no section_id
        ],
      },
    ];

    mockResponses(deals, []);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.segment_gaps).toHaveLength(1);
    expect(result.segment_gaps[0].type).toBe('section');
    expect(result.segment_gaps[0].label).toBe('部門');
    expect(result.segment_gaps[0].unset_count).toBe(1);
    expect(result.segment_gaps[0].sample_partners).toContain('GCP');
  });

  it('should detect account-item tag deviations', async () => {
    // 3 deals for same account, 2 with tag [1], 1 with tag [2]
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        partner_id: 100,
        partner_name: 'A',
        status: 'settled',
        details: [
          { account_item_id: 50, tax_code: 1, amount: 1000, tag_ids: [1] },
        ],
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2024-02-15',
        amount: 2000,
        type: 'expense',
        partner_id: 200,
        partner_name: 'B',
        status: 'settled',
        details: [
          { account_item_id: 50, tax_code: 1, amount: 2000, tag_ids: [1] },
        ],
      },
      {
        id: 3,
        company_id: 1,
        issue_date: '2024-03-15',
        amount: 3000,
        type: 'expense',
        partner_id: 300,
        partner_name: 'C',
        status: 'settled',
        details: [
          { account_item_id: 50, tax_code: 1, amount: 3000, tag_ids: [2] },
        ],
      },
    ];

    const tags = [
      { id: 1, company_id: 1, name: 'infra', available: true },
      { id: 2, company_id: 1, name: 'dev', available: true },
    ];

    mockResponses(deals, tags);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.account_deviations).toHaveLength(1);
    expect(result.account_deviations[0].account_item_id).toBe(50);
    expect(result.account_deviations[0].account_item_name).toBe('サーバー費用');
    expect(result.account_deviations[0].majority_pattern).toEqual(['infra']);
    expect(result.account_deviations[0].deviating_details).toBe(1);
    expect(result.account_deviations[0].total_details).toBe(3);
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
        details: [
          {
            account_item_id: 10,
            tax_code: 1,
            amount: 1000,
            tag_ids: [1],
            section_id: 1,
          },
        ],
      },
    ];

    const tags = [{ id: 1, company_id: 1, name: 'infra', available: true }];

    mockResponses(deals, tags);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.tag_inconsistencies).toHaveLength(0);
    expect(result.segment_gaps).toHaveLength(0);
    expect(result.account_deviations).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(1);
    expect(result.summary).toContain('問題なし');
  });

  it('should build correct period label', async () => {
    mockResponses([], []);

    const result1 = await client.checkTaggingConsistency(1, {
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });
    expect(result1.period).toBe('2024-01-01 ~ 2024-12-31');

    const result2 = await client.checkTaggingConsistency(1, {});
    expect(result2.period).toBe('all');
  });

  it('should pass date filters to fetchAllPages', async () => {
    mockResponses([], []);

    await client.checkTaggingConsistency(1, {
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

  it('should skip deals without partner_id for partner analysis', async () => {
    const deals = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2024-01-15',
        amount: 1000,
        type: 'expense',
        status: 'settled',
        // no partner_id
        details: [{ account_item_id: 10, tax_code: 1, amount: 1000 }],
      },
    ];

    mockResponses(deals, []);

    const result = await client.checkTaggingConsistency(1, {});

    expect(result.total_deals).toBe(1);
    expect(result.tag_inconsistencies).toHaveLength(0);
    expect(result.consistent_partner_count).toBe(0);
  });
});
