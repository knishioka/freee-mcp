import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

describe('FreeeClient Monthly Closing Check', () => {
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

  // Helper: mock wallet_txns GET with pagination
  function mockWalletTxnsResponse(txns: Record<string, unknown>[]) {
    mockAxiosInstance.get.mockImplementation((url: string) => {
      if (url === '/wallet_txns') {
        return Promise.resolve({
          data: { wallet_txns: txns, meta: { total_count: txns.length } },
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  }

  // Helper: build trial balance response
  function makeTrialBalanceResponse(
    balances: Array<{ account_item_name: string; closing_balance: number }>,
  ) {
    return {
      data: {
        trial_bs: {
          company_id: 123,
          fiscal_year: 2024,
          start_month: 12,
          end_month: 12,
          created_at: '2024-12-31',
          balances: balances.map((b) => ({
            hierarchy_level: 1,
            opening_balance: 0,
            debit_amount: 0,
            credit_amount: 0,
            ...b,
          })),
        },
      },
    };
  }

  // Helper: build walletables response
  function makeWalletablesResponse(
    walletables: Array<{
      id: number;
      name: string;
      type: string;
      walletable_balance?: number;
      last_balance?: number;
    }>,
  ) {
    return { data: { walletables } };
  }

  // Helper: build deals response
  function makeDealsResponse(deals: Record<string, unknown>[]) {
    return {
      data: { deals, meta: { total_count: deals.length } },
    };
  }

  describe('unprocessed_transactions check', () => {
    it('returns ok when no unprocessed transactions', async () => {
      const txns = [
        {
          id: 1,
          status: 3,
          date: '2024-12-01',
          amount: 1000,
          due_amount: 0,
          entry_side: 'income',
          walletable_type: 'bank_account',
          walletable_id: 1,
          company_id: 123,
        },
        {
          id: 2,
          status: 2,
          date: '2024-12-15',
          amount: 2000,
          due_amount: 0,
          entry_side: 'expense',
          walletable_type: 'bank_account',
          walletable_id: 1,
          company_id: 123,
        },
      ];
      mockWalletTxnsResponse(txns);

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'unprocessed_transactions',
      ]);

      expect(result.period).toBe('2024年12月');
      expect(result.overall_status).toBe('ok');
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].name).toBe('未処理明細チェック');
      expect(result.checks[0].status).toBe('ok');
    });

    it('returns warning when unprocessed transactions exist', async () => {
      const txns = [
        {
          id: 1,
          status: 1,
          date: '2024-12-01',
          amount: 5000,
          due_amount: 0,
          entry_side: 'income',
          walletable_type: 'bank_account',
          walletable_id: 1,
          company_id: 123,
          description: 'Unknown deposit',
        },
        {
          id: 2,
          status: 3,
          date: '2024-12-15',
          amount: 2000,
          due_amount: 0,
          entry_side: 'expense',
          walletable_type: 'bank_account',
          walletable_id: 1,
          company_id: 123,
        },
        {
          id: 3,
          status: 1,
          date: '2024-12-20',
          amount: 3000,
          due_amount: 0,
          entry_side: 'expense',
          walletable_type: 'credit_card',
          walletable_id: 2,
          company_id: 123,
        },
      ];
      mockWalletTxnsResponse(txns);

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'unprocessed_transactions',
      ]);

      expect(result.overall_status).toBe('warning');
      expect(result.checks[0].status).toBe('warning');
      expect(result.checks[0].details).toContain('2件');
      expect(result.checks[0].items).toHaveLength(2);
    });
  });

  describe('balance_verification check', () => {
    it('returns ok when balances match', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '現金', closing_balance: 100000 },
              { account_item_name: '普通預金', closing_balance: 500000 },
              { account_item_name: '売掛金', closing_balance: 300000 },
            ]),
          );
        }
        if (url === '/walletables') {
          return Promise.resolve(
            makeWalletablesResponse([
              {
                id: 1,
                name: '現金',
                type: 'wallet',
                walletable_balance: 100000,
              },
              {
                id: 2,
                name: 'メインバンク',
                type: 'bank_account',
                walletable_balance: 500000,
              },
            ]),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'balance_verification',
      ]);

      expect(result.overall_status).toBe('ok');
      expect(result.checks[0].name).toBe('残高突合チェック');
      expect(result.checks[0].status).toBe('ok');
    });

    it('returns warning when balances differ', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '普通預金', closing_balance: 500000 },
            ]),
          );
        }
        if (url === '/walletables') {
          return Promise.resolve(
            makeWalletablesResponse([
              {
                id: 1,
                name: 'メインバンク',
                type: 'bank_account',
                walletable_balance: 480000,
              },
            ]),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'balance_verification',
      ]);

      expect(result.overall_status).toBe('warning');
      expect(result.checks[0].status).toBe('warning');
      expect(result.checks[0].details).toContain('20000円');
    });

    it('excludes credit cards from walletable balance', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '現金', closing_balance: 50000 },
            ]),
          );
        }
        if (url === '/walletables') {
          return Promise.resolve(
            makeWalletablesResponse([
              {
                id: 1,
                name: '現金',
                type: 'wallet',
                walletable_balance: 50000,
              },
              {
                id: 2,
                name: 'クレジットカード',
                type: 'credit_card',
                walletable_balance: -200000,
              },
            ]),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'balance_verification',
      ]);

      expect(result.checks[0].status).toBe('ok');
    });
  });

  describe('temporary_accounts check', () => {
    it('returns ok when all temporary accounts are zero', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '仮払金', closing_balance: 0 },
              { account_item_name: '仮受金', closing_balance: 0 },
              { account_item_name: '立替金', closing_balance: 0 },
            ]),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'temporary_accounts',
      ]);

      expect(result.overall_status).toBe('ok');
      expect(result.checks[0].name).toBe('仮勘定残高チェック');
      expect(result.checks[0].status).toBe('ok');
    });

    it('returns warning when temporary accounts have non-zero balances', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '仮払金', closing_balance: 15000 },
              { account_item_name: '仮受金', closing_balance: 0 },
              { account_item_name: '立替金', closing_balance: 8000 },
              { account_item_name: '売上高', closing_balance: 1000000 },
            ]),
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'temporary_accounts',
      ]);

      expect(result.overall_status).toBe('warning');
      expect(result.checks[0].status).toBe('warning');
      expect(result.checks[0].details).toContain('仮払金');
      expect(result.checks[0].details).toContain('立替金');
      expect(result.checks[0].items).toHaveLength(2);
    });
  });

  describe('receivable_aging check', () => {
    it('returns ok when no unsettled income deals', async () => {
      const deals = [
        {
          id: 1,
          type: 'income',
          status: 'settled',
          issue_date: '2024-12-01',
          amount: 100000,
          company_id: 123,
          details: [],
        },
      ];

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/deals') {
          return Promise.resolve(makeDealsResponse(deals));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'receivable_aging',
      ]);

      expect(result.overall_status).toBe('ok');
      expect(result.checks[0].name).toBe('売掛金滞留チェック');
      expect(result.checks[0].status).toBe('ok');
    });

    it('returns warning when there are old unsettled receivables', async () => {
      const deals = [
        {
          id: 1,
          type: 'income',
          status: 'unsettled',
          issue_date: '2024-08-01',
          amount: 200000,
          partner_name: 'A社',
          company_id: 123,
          details: [],
        },
        {
          id: 2,
          type: 'income',
          status: 'unsettled',
          issue_date: '2024-12-15',
          amount: 50000,
          partner_name: 'B社',
          company_id: 123,
          details: [],
        },
        {
          id: 3,
          type: 'expense',
          status: 'unsettled',
          issue_date: '2024-08-01',
          amount: 300000,
          partner_name: 'C社',
          company_id: 123,
          details: [],
        },
      ];

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/deals') {
          return Promise.resolve(makeDealsResponse(deals));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'receivable_aging',
      ]);

      expect(result.checks[0].name).toBe('売掛金滞留チェック');
      expect(result.checks[0].status).toBe('warning');
      expect(result.checks[0].details).toContain('2件');
      // Should not include expense deals
      const items = result.checks[0].items as Record<string, unknown>[];
      expect(items).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buckets = (items[0] as any).buckets;
      // 90+ day bucket should have the old deal
      const over90 = buckets.find(
        (b: Record<string, unknown>) => b.label === '90日超',
      );
      expect(over90.count).toBe(1);
      expect(over90.amount).toBe(200000);
    });
  });

  describe('payable_aging check', () => {
    it('returns appropriate results for unsettled expense deals', async () => {
      const deals = [
        {
          id: 1,
          type: 'expense',
          status: 'unsettled',
          issue_date: '2024-12-01',
          amount: 80000,
          partner_name: 'D社',
          company_id: 123,
          details: [],
        },
      ];

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/deals') {
          return Promise.resolve(makeDealsResponse(deals));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'payable_aging',
      ]);

      expect(result.checks[0].name).toBe('買掛金滞留チェック');
      expect(result.checks[0].details).toContain('1件');
      expect(result.checks[0].details).toContain('80000円');
    });
  });

  describe('unattached_receipts check', () => {
    it('returns warning stub with preparation message', async () => {
      // No API mocking needed — this is a stub
      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'unattached_receipts',
      ]);

      expect(result.overall_status).toBe('warning');
      expect(result.checks[0].name).toBe('未紐付け証憑チェック');
      expect(result.checks[0].status).toBe('warning');
      expect(result.checks[0].details).toContain('準備中');
    });
  });

  describe('all checks combined', () => {
    it('runs all checks when no filter specified', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '現金', closing_balance: 100000 },
              { account_item_name: '仮払金', closing_balance: 0 },
            ]),
          );
        }
        if (url === '/walletables') {
          return Promise.resolve(
            makeWalletablesResponse([
              {
                id: 1,
                name: '現金',
                type: 'wallet',
                walletable_balance: 100000,
              },
            ]),
          );
        }
        if (url === '/wallet_txns') {
          return Promise.resolve({
            data: { wallet_txns: [], meta: { total_count: 0 } },
          });
        }
        if (url === '/deals') {
          return Promise.resolve(makeDealsResponse([]));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12);

      expect(result.period).toBe('2024年12月');
      // unattached_receipts stub returns warning, so overall is warning
      expect(result.overall_status).toBe('warning');
      expect(result.checks).toHaveLength(6);
      expect(result.summary).toContain('1項目で要確認');
    });

    it('computes correct overall status with mixed results', async () => {
      // 1 warning (unprocessed txns) + 1 ok (balance check) = overall warning
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/reports/trial_bs') {
          return Promise.resolve(
            makeTrialBalanceResponse([
              { account_item_name: '現金', closing_balance: 100000 },
            ]),
          );
        }
        if (url === '/walletables') {
          return Promise.resolve(
            makeWalletablesResponse([
              {
                id: 1,
                name: '現金',
                type: 'wallet',
                walletable_balance: 100000,
              },
            ]),
          );
        }
        if (url === '/wallet_txns') {
          return Promise.resolve({
            data: {
              wallet_txns: [
                {
                  id: 1,
                  status: 1,
                  date: '2024-12-01',
                  amount: 1000,
                  due_amount: 0,
                  entry_side: 'income',
                  walletable_type: 'bank_account',
                  walletable_id: 1,
                  company_id: 123,
                },
              ],
              meta: { total_count: 1 },
            },
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 12, [
        'unprocessed_transactions',
        'balance_verification',
      ]);

      expect(result.overall_status).toBe('warning');
      expect(result.checks).toHaveLength(2);
      expect(result.summary).toContain('1項目OK');
      expect(result.summary).toContain('1項目で要確認');
    });

    it('handles correct date range for February', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/wallet_txns') {
          return Promise.resolve({
            data: { wallet_txns: [], meta: { total_count: 0 } },
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getMonthlyClosingChecklist(123, 2024, 2, [
        'unprocessed_transactions',
      ]);

      // 2024 is a leap year, so Feb has 29 days
      expect(result.period).toBe('2024年2月');
      // Verify the API was called with correct date params
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/wallet_txns',
        expect.objectContaining({
          params: expect.objectContaining({
            start_date: '2024-02-01',
            end_date: '2024-02-29',
          }),
        }),
      );
    });
  });
});
