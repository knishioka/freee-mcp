import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';
import type { FreeeTrialBalanceItem } from '../../types/freee.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

function makeBalanceItem(
  overrides?: Partial<FreeeTrialBalanceItem>,
): FreeeTrialBalanceItem {
  return {
    account_item_name: '売上高',
    hierarchy_level: 1,
    opening_balance: 0,
    debit_amount: 0,
    credit_amount: 0,
    closing_balance: 1000000,
    ...overrides,
  };
}

function makePLReport(
  balances: FreeeTrialBalanceItem[],
  overrides?: Record<string, unknown>,
) {
  return {
    company_id: 123,
    fiscal_year: 2024,
    start_month: 1,
    end_month: 12,
    created_at: '2024-01-01',
    balances,
    ...overrides,
  };
}

describe('FreeeClient Analysis Methods', () => {
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

  describe('comparePeriods', () => {
    it('should compare two P&L periods and compute changes', async () => {
      const period1Balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 1000000,
        }),
        makeBalanceItem({
          account_item_name: '売上原価',
          closing_balance: 400000,
        }),
        makeBalanceItem({
          account_item_name: '営業利益',
          closing_balance: 300000,
        }),
      ];
      const period2Balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 1200000,
        }),
        makeBalanceItem({
          account_item_name: '売上原価',
          closing_balance: 450000,
        }),
        makeBalanceItem({
          account_item_name: '営業利益',
          closing_balance: 400000,
        }),
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { trial_pl: makePLReport(period1Balances) },
        })
        .mockResolvedValueOnce({
          data: { trial_pl: makePLReport(period2Balances) },
        });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(result.report_type).toBe('profit_loss');
      expect(result.period1.metrics['売上高']).toBe(1000000);
      expect(result.period2.metrics['売上高']).toBe(1200000);
      expect(result.changes['売上高'].amount).toBe(200000);
      expect(result.changes['売上高'].percentage).toBe(20);
      expect(result.changes['売上原価'].amount).toBe(50000);
      expect(result.changes['売上原価'].percentage).toBe(12.5);
      expect(result.changes['営業利益'].amount).toBe(100000);
      expect(result.changes['営業利益'].percentage).toBeCloseTo(33.33, 1);
    });

    it('should make parallel API calls for both periods', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } });

      await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl',
        expect.objectContaining({
          params: expect.objectContaining({ fiscal_year: 2023 }),
        }),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl',
        expect.objectContaining({
          params: expect.objectContaining({ fiscal_year: 2024 }),
        }),
      );
    });

    it('should use balance sheet endpoint when reportType is balance_sheet', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_bs: makePLReport(balances) } })
        .mockResolvedValueOnce({ data: { trial_bs: makePLReport(balances) } });

      await client.comparePeriods(
        123,
        'balance_sheet',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_bs',
        expect.anything(),
      );
    });

    it('should handle zero base values with null percentage', async () => {
      const period1Balances = [
        makeBalanceItem({ account_item_name: '新規売上', closing_balance: 0 }),
      ];
      const period2Balances = [
        makeBalanceItem({
          account_item_name: '新規売上',
          closing_balance: 500000,
        }),
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { trial_pl: makePLReport(period1Balances) },
        })
        .mockResolvedValueOnce({
          data: { trial_pl: makePLReport(period2Balances) },
        });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(result.changes['新規売上'].amount).toBe(500000);
      expect(result.changes['新規売上'].percentage).toBeNull();
    });

    it('should return 0 percentage when both periods are zero', async () => {
      const balances = [
        makeBalanceItem({
          account_item_name: '未使用科目',
          closing_balance: 0,
        }),
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(result.changes['未使用科目'].amount).toBe(0);
      expect(result.changes['未使用科目'].percentage).toBe(0);
    });

    it('should generate highlights for significant changes', async () => {
      const period1 = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 1000000,
        }),
        makeBalanceItem({
          account_item_name: '安定科目',
          closing_balance: 500000,
        }),
      ];
      const period2 = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 1500000,
        }),
        makeBalanceItem({
          account_item_name: '安定科目',
          closing_balance: 510000,
        }),
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period1) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period2) } });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      // 50% change should be high significance
      const revenueHighlight = result.highlights.find(
        (h) => h.item === '売上高',
      );
      expect(revenueHighlight).toBeDefined();
      expect(revenueHighlight?.significance).toBe('high');
      expect(revenueHighlight?.change).toBe('+50%');

      // 2% change should be low significance (not in highlights)
      const stableHighlight = result.highlights.find(
        (h) => h.item === '安定科目',
      );
      expect(stableHighlight).toBeUndefined();
    });

    it('should handle negative values correctly', async () => {
      const period1 = [
        makeBalanceItem({
          account_item_name: '営業損失',
          closing_balance: -100000,
        }),
      ];
      const period2 = [
        makeBalanceItem({
          account_item_name: '営業損失',
          closing_balance: -120000,
        }),
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period1) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period2) } });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(result.changes['営業損失'].amount).toBe(-20000);
      expect(result.changes['営業損失'].percentage).toBe(-20);
    });

    it('should pass breakdownDisplayType to API calls', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(balances) } });

      await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
        'partner',
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl',
        expect.objectContaining({
          params: expect.objectContaining({
            breakdown_display_type: 'partner',
          }),
        }),
      );
    });

    it('should limit highlights to top 10', async () => {
      // Create 15 items all with >10% changes
      const period1 = Array.from({ length: 15 }, (_, i) =>
        makeBalanceItem({
          account_item_name: `科目${i}`,
          closing_balance: 100000,
        }),
      );
      const period2 = Array.from({ length: 15 }, (_, i) =>
        makeBalanceItem({
          account_item_name: `科目${i}`,
          closing_balance: 100000 + (i + 1) * 20000,
        }),
      );

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period1) } })
        .mockResolvedValueOnce({ data: { trial_pl: makePLReport(period2) } });

      const result = await client.comparePeriods(
        123,
        'profit_loss',
        { fiscal_year: 2023, start_month: 1, end_month: 12 },
        { fiscal_year: 2024, start_month: 1, end_month: 12 },
      );

      expect(result.highlights.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getMonthlyTrends', () => {
    it('should fetch all 12 months in parallel', async () => {
      const balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 100000,
        }),
      ];

      // Mock 12 month responses
      for (let i = 0; i < 12; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { trial_pl: makePLReport(balances) },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(12);
      expect(result.months).toHaveLength(12);
      expect(result.fiscal_year).toBe(2024);
      expect(result.report_type).toBe('profit_loss');
    });

    it('should fetch only specified months', async () => {
      const balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 100000,
        }),
      ];

      for (let i = 0; i < 3; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { trial_pl: makePLReport(balances) },
        });
      }

      const result = await client.getMonthlyTrends(
        123,
        2024,
        'profit_loss',
        [4, 5, 6],
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result.months).toHaveLength(3);
      expect(result.months[0].month).toBe(4);
      expect(result.months[1].month).toBe(5);
      expect(result.months[2].month).toBe(6);
    });

    it('should extract metrics per month', async () => {
      for (let month = 1; month <= 12; month++) {
        const balances = [
          makeBalanceItem({
            account_item_name: '売上高',
            closing_balance: month * 100000,
          }),
          makeBalanceItem({
            account_item_name: '売上原価',
            closing_balance: month * 40000,
          }),
        ];
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { trial_pl: makePLReport(balances) },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');

      expect(result.months[0].metrics['売上高']).toBe(100000);
      expect(result.months[11].metrics['売上高']).toBe(1200000);
      expect(result.months[0].metrics['売上原価']).toBe(40000);
    });

    it('should compute summary statistics correctly', async () => {
      const values = [
        100000, 120000, 110000, 130000, 150000, 140000, 160000, 180000, 170000,
        190000, 200000, 210000,
      ];

      for (const value of values) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: value,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');

      expect(result.summary.primary_metric).toBe('売上高');
      expect(result.summary.avg).toBe(
        Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      );
      expect(result.summary.max.value).toBe(210000);
      expect(result.summary.max.month).toBe(12);
      expect(result.summary.min.value).toBe(100000);
      expect(result.summary.min.month).toBe(1);
    });

    it('should detect increasing trend', async () => {
      const values = [
        100000, 110000, 120000, 130000, 140000, 150000, 160000, 170000, 180000,
        190000, 200000, 250000,
      ];

      for (const value of values) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: value,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');
      expect(result.summary.trend).toBe('increasing');
    });

    it('should detect decreasing trend', async () => {
      const values = [
        250000, 240000, 230000, 220000, 210000, 200000, 190000, 180000, 170000,
        160000, 150000, 100000,
      ];

      for (const value of values) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: value,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');
      expect(result.summary.trend).toBe('decreasing');
    });

    it('should detect stable trend', async () => {
      const values = [
        100000, 101000, 99000, 100500, 99500, 100200, 99800, 100100, 99900,
        100300, 99700, 100000,
      ];

      for (const value of values) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: value,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');
      expect(result.summary.trend).toBe('stable');
    });

    it('should handle empty balances gracefully', async () => {
      for (let i = 0; i < 12; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { trial_pl: makePLReport([]) },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');

      expect(result.months).toHaveLength(12);
      expect(result.summary.primary_metric).toBe('');
      expect(result.summary.avg).toBe(0);
      expect(result.summary.trend).toBe('stable');
    });

    it('should use balance sheet endpoint for balance_sheet reportType', async () => {
      const balances = [makeBalanceItem()];
      for (let i = 0; i < 3; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { trial_bs: makePLReport(balances) },
        });
      }

      await client.getMonthlyTrends(123, 2024, 'balance_sheet', [1, 2, 3]);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_bs',
        expect.anything(),
      );
    });
  });

  describe('getCashPosition', () => {
    it('should combine walletables, invoices, and deals', async () => {
      // Mock getWalletables
      mockAxiosInstance.get.mockImplementation(
        (url: string, _config?: { params?: Record<string, unknown> }) => {
          if (url === '/walletables') {
            return Promise.resolve({
              data: {
                walletables: [
                  {
                    id: 1,
                    name: '普通預金',
                    type: 'bank_account',
                    walletable_balance: 4500000,
                  },
                  {
                    id: 2,
                    name: '現金',
                    type: 'wallet',
                    walletable_balance: 500000,
                  },
                  {
                    id: 3,
                    name: '法人カード',
                    type: 'credit_card',
                    walletable_balance: -200000,
                  },
                ],
              },
            });
          }
          if (url === '/invoices') {
            return Promise.resolve({
              data: {
                invoices: [
                  {
                    id: 1,
                    company_id: 123,
                    issue_date: '2024-01-01',
                    partner_id: 1,
                    invoice_number: 'INV-001',
                    total_amount: 2000000,
                    invoice_status: 'sent',
                    payment_status: 'unsettled',
                    due_date: '2024-02-15',
                    invoice_lines: [],
                  },
                ],
              },
            });
          }
          if (url === '/deals') {
            return Promise.resolve({
              data: {
                deals: [
                  {
                    id: 1,
                    company_id: 123,
                    issue_date: '2024-01-01',
                    amount: 1500000,
                    type: 'expense',
                    status: 'unsettled',
                    due_date: '2024-02-28',
                    details: [],
                  },
                  {
                    id: 2,
                    company_id: 123,
                    issue_date: '2024-01-05',
                    amount: 300000,
                    type: 'expense',
                    status: 'settled',
                    details: [],
                  },
                  {
                    id: 3,
                    company_id: 123,
                    issue_date: '2024-01-10',
                    amount: 500000,
                    type: 'income',
                    status: 'unsettled',
                    details: [],
                  },
                ],
              },
            });
          }
          return Promise.reject(new Error(`Unexpected URL: ${url}`));
        },
      );

      const result = await client.getCashPosition(123);

      // Total cash = bank (4500000) + wallet (500000) = 5000000 (excludes credit card)
      expect(result.total_cash).toBe(5000000);

      // All 3 accounts included
      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[0].name).toBe('普通預金');

      // Receivables from unsettled invoices + unsettled income deals
      // Invoice: 2000000 + Income deal (id:3): 500000
      expect(result.receivables.total).toBe(2500000);
      expect(result.receivables.count).toBe(2);

      // Payables from unsettled expense deals (only the 1500000 one, settled is excluded)
      expect(result.payables.total).toBe(1500000);
      expect(result.payables.count).toBe(1);

      // Net position = cash + receivables - payables
      expect(result.net_position).toBe(5000000 + 2500000 - 1500000);
    });

    it('should identify overdue invoices', async () => {
      const pastDate = '2020-01-01';

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/walletables') {
          return Promise.resolve({ data: { walletables: [] } });
        }
        if (url === '/invoices') {
          return Promise.resolve({
            data: {
              invoices: [
                {
                  id: 1,
                  company_id: 123,
                  issue_date: '2020-01-01',
                  partner_id: 1,
                  invoice_number: 'INV-001',
                  total_amount: 300000,
                  invoice_status: 'sent',
                  payment_status: 'unsettled',
                  due_date: pastDate,
                  invoice_lines: [],
                },
                {
                  id: 2,
                  company_id: 123,
                  issue_date: '2020-01-01',
                  partner_id: 2,
                  invoice_number: 'INV-002',
                  total_amount: 700000,
                  invoice_status: 'sent',
                  payment_status: 'unsettled',
                  due_date: '2099-12-31',
                  invoice_lines: [],
                },
              ],
            },
          });
        }
        if (url === '/deals') {
          return Promise.resolve({ data: { deals: [] } });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getCashPosition(123);

      expect(result.receivables.total).toBe(1000000);
      expect(result.receivables.overdue).toBe(300000);
      expect(result.receivables.count).toBe(2);
    });

    it('should identify overdue expense deals', async () => {
      const pastDate = '2020-01-01';

      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/walletables') {
          return Promise.resolve({ data: { walletables: [] } });
        }
        if (url === '/invoices') {
          return Promise.resolve({ data: { invoices: [] } });
        }
        if (url === '/deals') {
          return Promise.resolve({
            data: {
              deals: [
                {
                  id: 1,
                  company_id: 123,
                  issue_date: '2020-01-01',
                  amount: 100000,
                  type: 'expense',
                  status: 'unsettled',
                  due_date: pastDate,
                  details: [],
                },
                {
                  id: 2,
                  company_id: 123,
                  issue_date: '2020-01-05',
                  amount: 200000,
                  type: 'expense',
                  status: 'unsettled',
                  due_date: '2099-12-31',
                  details: [],
                },
              ],
            },
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getCashPosition(123);

      expect(result.payables.total).toBe(300000);
      expect(result.payables.overdue).toBe(100000);
      expect(result.payables.count).toBe(2);
    });

    it('should handle empty data gracefully', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/walletables') {
          return Promise.resolve({ data: { walletables: [] } });
        }
        if (url === '/invoices') {
          return Promise.resolve({ data: { invoices: [] } });
        }
        if (url === '/deals') {
          return Promise.resolve({ data: { deals: [] } });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getCashPosition(123);

      expect(result.total_cash).toBe(0);
      expect(result.accounts).toHaveLength(0);
      expect(result.receivables).toEqual({ total: 0, overdue: 0, count: 0 });
      expect(result.payables).toEqual({ total: 0, overdue: 0, count: 0 });
      expect(result.net_position).toBe(0);
    });

    it('should use last_balance when walletable_balance is undefined', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/walletables') {
          return Promise.resolve({
            data: {
              walletables: [
                {
                  id: 1,
                  name: '口座A',
                  type: 'bank_account',
                  last_balance: 1000000,
                },
              ],
            },
          });
        }
        if (url === '/invoices') {
          return Promise.resolve({ data: { invoices: [] } });
        }
        if (url === '/deals') {
          return Promise.resolve({ data: { deals: [] } });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getCashPosition(123);

      expect(result.total_cash).toBe(1000000);
      expect(result.accounts[0].balance).toBe(1000000);
    });

    it('should exclude income deals from payables', async () => {
      mockAxiosInstance.get.mockImplementation((url: string) => {
        if (url === '/walletables') {
          return Promise.resolve({ data: { walletables: [] } });
        }
        if (url === '/invoices') {
          return Promise.resolve({ data: { invoices: [] } });
        }
        if (url === '/deals') {
          return Promise.resolve({
            data: {
              deals: [
                {
                  id: 1,
                  company_id: 123,
                  issue_date: '2024-01-01',
                  amount: 500000,
                  type: 'income',
                  status: 'unsettled',
                  details: [],
                },
              ],
            },
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await client.getCashPosition(123);

      // Income deals should not appear in payables
      expect(result.payables.total).toBe(0);
      expect(result.payables.count).toBe(0);
    });
  });

  describe('computeTrend (via getMonthlyTrends)', () => {
    it('should return stable for single value', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          trial_pl: makePLReport([
            makeBalanceItem({
              account_item_name: '売上高',
              closing_balance: 100000,
            }),
          ]),
        },
      });

      const result = await client.getMonthlyTrends(
        123,
        2024,
        'profit_loss',
        [1],
      );
      expect(result.summary.trend).toBe('stable');
    });

    it('should return stable for all-zero values', async () => {
      for (let i = 0; i < 12; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: 0,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');
      expect(result.summary.trend).toBe('stable');
    });

    it('should return decreasing when starting from zero and going negative', async () => {
      const values = [0, 0, 0, 0, -100000, -200000, -300000, -400000, -500000, -600000, -700000, -800000];
      for (const val of values) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            trial_pl: makePLReport([
              makeBalanceItem({
                account_item_name: '売上高',
                closing_balance: val,
              }),
            ]),
          },
        });
      }

      const result = await client.getMonthlyTrends(123, 2024, 'profit_loss');
      expect(result.summary.trend).toBe('decreasing');
    });
  });
});
