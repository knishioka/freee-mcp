import { jest } from '@jest/globals';
import axios from 'axios';
import { FreeeClient } from '../../api/freeeClient.js';
import { TokenManager } from '../../auth/tokenManager.js';
import type {
  FreeeTrialBalance,
  FreeeTrialBalanceItem,
  FreeeWalletable,
} from '../../types/freee.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../auth/tokenManager.js');

function makeBalanceItem(
  overrides?: Partial<FreeeTrialBalanceItem>,
): FreeeTrialBalanceItem {
  return {
    account_item_name: '',
    hierarchy_level: 1,
    opening_balance: 0,
    debit_amount: 0,
    credit_amount: 0,
    closing_balance: 0,
    ...overrides,
  };
}

function makePLBalances(): FreeeTrialBalanceItem[] {
  return [
    makeBalanceItem({ account_item_name: '売上高', closing_balance: 10000000 }),
    makeBalanceItem({
      account_item_name: '営業利益',
      closing_balance: 2000000,
    }),
    makeBalanceItem({
      account_item_name: '経常利益',
      closing_balance: 1500000,
    }),
    makeBalanceItem({
      account_item_name: '売上原価',
      closing_balance: 6000000,
    }),
  ];
}

function makeBSBalances(): FreeeTrialBalanceItem[] {
  return [
    makeBalanceItem({
      account_item_name: '流動資産',
      closing_balance: 5000000,
    }),
    makeBalanceItem({
      account_item_name: '固定資産',
      closing_balance: 3000000,
    }),
    makeBalanceItem({
      account_item_name: '流動負債',
      closing_balance: 2500000,
    }),
    makeBalanceItem({ account_item_name: '純資産', closing_balance: 4000000 }),
    makeBalanceItem({ account_item_name: '資産', closing_balance: 8000000 }),
    makeBalanceItem({ account_item_name: '売掛金', closing_balance: 1200000 }),
    makeBalanceItem({ account_item_name: '買掛金', closing_balance: 800000 }),
  ];
}

function makeWalletables(): FreeeWalletable[] {
  return [
    {
      id: 1,
      name: 'メイン銀行',
      type: 'bank_account',
      walletable_balance: 3000000,
    },
    {
      id: 2,
      name: '小口現金',
      type: 'wallet',
      walletable_balance: 200000,
    },
    {
      id: 3,
      name: 'クレジットカード',
      type: 'credit_card',
      walletable_balance: -100000,
    },
  ];
}

function makeTrialBalanceResponse(
  balances: FreeeTrialBalanceItem[],
  key: string,
): { data: { [key: string]: FreeeTrialBalance } } {
  return {
    data: {
      [key]: {
        company_id: 123,
        fiscal_year: 2024,
        start_month: 1,
        end_month: 12,
        created_at: '2024-01-01',
        balances,
      },
    },
  };
}

describe('FreeeClient.getKpiDashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: FreeeClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAxiosInstance: any;

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

    const mockTokenManager = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MockedTokenManager.mockImplementation(() => mockTokenManager as any);

    client = new FreeeClient(
      'id',
      'secret',
      'http://redirect',
      mockTokenManager as unknown as TokenManager,
    );
  });

  it('should fetch PL, BS, and walletables in parallel and compute KPIs', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Verify all 3 API calls were made
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);

    // Verify structure
    expect(result.fiscal_year).toBe(2024);
    expect(result.start_month).toBe(1);
    expect(result.end_month).toBe(12);
    expect(result.profitability).toHaveLength(3);
    expect(result.safety).toHaveLength(2);
    expect(result.efficiency).toHaveLength(2);
    expect(result.liquidity).toHaveLength(2);
    expect(result.summary).toBeDefined();
  });

  it('should compute profitability KPIs correctly', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Revenue = 10,000,000
    expect(result.profitability[0]).toMatchObject({
      label: '売上高',
      value: 10000000,
      unit: '円',
    });

    // Operating margin = 2,000,000 / 10,000,000 * 100 = 20%
    expect(result.profitability[1]).toMatchObject({
      label: '営業利益率',
      value: 20,
      unit: '%',
      status: 'healthy',
    });

    // Ordinary margin = 1,500,000 / 10,000,000 * 100 = 15%
    expect(result.profitability[2]).toMatchObject({
      label: '経常利益率',
      value: 15,
      unit: '%',
      status: 'healthy',
    });
  });

  it('should compute safety KPIs correctly', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Current ratio = 5,000,000 / 2,500,000 * 100 = 200%
    expect(result.safety[0]).toMatchObject({
      label: '流動比率',
      value: 200,
      unit: '%',
      status: 'healthy',
    });

    // Equity ratio = 4,000,000 / 8,000,000 * 100 = 50%
    expect(result.safety[1]).toMatchObject({
      label: '自己資本比率',
      value: 50,
      unit: '%',
      status: 'healthy',
    });
  });

  it('should compute efficiency KPIs correctly', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Receivable days = 1,200,000 / (10,000,000 / (12 * 30)) = ~43 days
    expect(result.efficiency[0].label).toBe('売上債権回転日数');
    expect(result.efficiency[0].unit).toBe('日');
    expect(result.efficiency[0].value).toBeGreaterThan(0);

    // Payable days = 800,000 / (6,000,000 / (12 * 30)) = ~48 days
    expect(result.efficiency[1].label).toBe('仕入債務回転日数');
    expect(result.efficiency[1].unit).toBe('日');
    expect(result.efficiency[1].value).toBeGreaterThan(0);
  });

  it('should compute liquidity KPIs correctly (excluding credit cards)', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Cash = 3,000,000 (bank) + 200,000 (wallet) = 3,200,000 (credit card excluded)
    expect(result.liquidity[0]).toMatchObject({
      label: '現金・預金残高',
      value: 3200000,
      unit: '円',
    });

    // Working capital = 5,000,000 - 2,500,000 = 2,500,000
    expect(result.liquidity[1]).toMatchObject({
      label: '運転資本',
      value: 2500000,
      unit: '円',
    });
  });

  it('should assign health statuses correctly', async () => {
    const poorPL = [
      makeBalanceItem({
        account_item_name: '売上高',
        closing_balance: 10000000,
      }),
      makeBalanceItem({
        account_item_name: '営業利益',
        closing_balance: 300000,
      }),
      makeBalanceItem({
        account_item_name: '経常利益',
        closing_balance: 200000,
      }),
      makeBalanceItem({
        account_item_name: '売上原価',
        closing_balance: 8000000,
      }),
    ];

    const poorBS = [
      makeBalanceItem({
        account_item_name: '流動資産',
        closing_balance: 1000000,
      }),
      makeBalanceItem({
        account_item_name: '固定資産',
        closing_balance: 5000000,
      }),
      makeBalanceItem({
        account_item_name: '流動負債',
        closing_balance: 4000000,
      }),
      makeBalanceItem({ account_item_name: '純資産', closing_balance: 500000 }),
      makeBalanceItem({ account_item_name: '資産', closing_balance: 6000000 }),
      makeBalanceItem({ account_item_name: '売掛金', closing_balance: 500000 }),
      makeBalanceItem({ account_item_name: '買掛金', closing_balance: 300000 }),
    ];

    mockAxiosInstance.get
      .mockResolvedValueOnce(makeTrialBalanceResponse(poorPL, 'trial_pl'))
      .mockResolvedValueOnce(makeTrialBalanceResponse(poorBS, 'trial_bs'))
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Operating margin = 3% → warning (< 5%)
    expect(result.profitability[1].status).toBe('warning');

    // Current ratio = 25% → warning (< 120%)
    expect(result.safety[0].status).toBe('warning');

    // Equity ratio = 8.3% → warning (< 20%)
    expect(result.safety[1].status).toBe('warning');

    // Summary should mention warnings
    expect(result.summary).toContain('要注意');
  });

  it('should handle zero revenue gracefully', async () => {
    const zeroPL = [
      makeBalanceItem({ account_item_name: '売上高', closing_balance: 0 }),
      makeBalanceItem({ account_item_name: '営業利益', closing_balance: 0 }),
      makeBalanceItem({ account_item_name: '経常利益', closing_balance: 0 }),
      makeBalanceItem({ account_item_name: '売上原価', closing_balance: 0 }),
    ];

    mockAxiosInstance.get
      .mockResolvedValueOnce(makeTrialBalanceResponse(zeroPL, 'trial_pl'))
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Margins should be 0 when revenue is 0
    expect(result.profitability[1].value).toBe(0);
    expect(result.profitability[2].value).toBe(0);

    // Turnover days should be 0 when revenue is 0
    expect(result.efficiency[0].value).toBe(0);
  });

  it('should support single-month mode', async () => {
    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makeBSBalances(), 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 6,
      end_month: 6,
    });

    expect(result.start_month).toBe(6);
    expect(result.end_month).toBe(6);

    // Verify API was called with single month params
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/reports/trial_pl',
      expect.objectContaining({
        params: expect.objectContaining({
          start_month: 6,
          end_month: 6,
        }),
      }),
    );
  });

  it('should use fallback totalAssets when top-level not found', async () => {
    const bsWithoutTotal = [
      makeBalanceItem({
        account_item_name: '流動資産',
        closing_balance: 5000000,
      }),
      makeBalanceItem({
        account_item_name: '固定資産',
        closing_balance: 3000000,
      }),
      makeBalanceItem({
        account_item_name: '流動負債',
        closing_balance: 2500000,
      }),
      makeBalanceItem({
        account_item_name: '純資産',
        closing_balance: 4000000,
      }),
      // No '資産' entry
    ];

    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(bsWithoutTotal, 'trial_bs'),
      )
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    // Equity ratio = 4,000,000 / (5,000,000 + 3,000,000) * 100 = 50%
    expect(result.safety[1]).toMatchObject({
      label: '自己資本比率',
      value: 50,
      unit: '%',
      status: 'healthy',
    });
  });

  it('should return "全指標健全" summary when all metrics are healthy', async () => {
    // Use low receivables/payables so turnover days <= 30
    const healthyBS = [
      makeBalanceItem({
        account_item_name: '流動資産',
        closing_balance: 5000000,
      }),
      makeBalanceItem({
        account_item_name: '固定資産',
        closing_balance: 3000000,
      }),
      makeBalanceItem({
        account_item_name: '流動負債',
        closing_balance: 2500000,
      }),
      makeBalanceItem({
        account_item_name: '純資産',
        closing_balance: 4000000,
      }),
      makeBalanceItem({
        account_item_name: '資産',
        closing_balance: 8000000,
      }),
      makeBalanceItem({
        account_item_name: '売掛金',
        closing_balance: 500000,
      }),
      makeBalanceItem({
        account_item_name: '買掛金',
        closing_balance: 300000,
      }),
    ];

    mockAxiosInstance.get
      .mockResolvedValueOnce(
        makeTrialBalanceResponse(makePLBalances(), 'trial_pl'),
      )
      .mockResolvedValueOnce(makeTrialBalanceResponse(healthyBS, 'trial_bs'))
      .mockResolvedValueOnce({ data: { walletables: makeWalletables() } });

    const result = await client.getKpiDashboard(123, {
      fiscal_year: 2024,
      start_month: 1,
      end_month: 12,
    });

    expect(result.summary).toBe('全指標健全');
  });
});
