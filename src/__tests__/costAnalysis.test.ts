import { jest } from '@jest/globals';
import type { FreeeTrialBalance, CostAnalysisResult } from '../types/freee.js';

// We test getCostAnalysis logic by directly calling it with mocked getProfitLoss
// Since getCostAnalysis is on FreeeClient, we import the real class (not mocked)
// and override only getProfitLoss on the prototype

const makePl = (
  balances: Array<{
    account_item_name: string;
    hierarchy_level: number;
    closing_balance: number;
    account_category_name?: string;
  }>,
): FreeeTrialBalance => ({
  company_id: 123,
  fiscal_year: 2024,
  start_month: 1,
  end_month: 12,
  created_at: '2024-01-01',
  balances: balances.map((b) => ({
    account_item_name: b.account_item_name,
    hierarchy_level: b.hierarchy_level,
    closing_balance: b.closing_balance,
    account_category_name: b.account_category_name,
    opening_balance: 0,
    debit_amount: 0,
    credit_amount: 0,
  })),
});

// Mock axios to prevent real HTTP calls during FreeeClient construction
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
    },
  };
});

describe('freee_cost_analysis', () => {
  let FreeeClient: any;
  let mockTokenManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Dynamic import to ensure axios mock is in place
    const mod = await import('../api/freeeClient.js');
    FreeeClient = mod.FreeeClient;

    mockTokenManager = {
      loadTokens: jest.fn(),
      saveTokens: jest.fn(),
      setToken: jest.fn(),
      getToken: jest.fn(),
      removeToken: jest.fn(),
      getAllCompanyIds: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenExpiryStatus: jest.fn(),
    };
  });

  function createClient(getProfitLossMock: jest.Mock): any {
    const client = new FreeeClient(
      'id',
      'secret',
      'redirect',
      mockTokenManager,
    );
    client.getProfitLoss = getProfitLossMock;
    return client;
  }

  describe('getCostAnalysis', () => {
    it('should detect anomalies exceeding threshold', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 800000,
        },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 5000000,
        },
        {
          account_item_name: '地代家賃',
          hierarchy_level: 1,
          closing_balance: 8000000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 300000,
        },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 3000000,
        },
        {
          account_item_name: '地代家賃',
          hierarchy_level: 1,
          closing_balance: 7500000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
        threshold: 50,
      });

      // 交際費: +166.7%, 外注費: +66.7% should be flagged
      // 地代家賃: +6.7% should NOT be flagged
      expect(result.anomalies.length).toBe(2);
      expect(result.anomalies[0].account_item_name).toBe('交際費');
      expect(result.anomalies[0].change_percentage).toBeCloseTo(166.67, 1);
      expect(result.anomalies[1].account_item_name).toBe('外注費');
      expect(result.anomalies[1].change_percentage).toBeCloseTo(66.67, 1);
    });

    it('should classify expenses as fixed or variable', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '地代家賃',
          hierarchy_level: 1,
          closing_balance: 8000000,
        },
        {
          account_item_name: '給料手当',
          hierarchy_level: 1,
          closing_balance: 15000000,
        },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 5000000,
        },
        {
          account_item_name: '広告宣伝費',
          hierarchy_level: 1,
          closing_balance: 3000000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '地代家賃',
          hierarchy_level: 1,
          closing_balance: 8000000,
        },
        {
          account_item_name: '給料手当',
          hierarchy_level: 1,
          closing_balance: 15000000,
        },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 5000000,
        },
        {
          account_item_name: '広告宣伝費',
          hierarchy_level: 1,
          closing_balance: 3000000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
      });

      const fixed = result.cost_composition.find((c) => c.category === 'fixed');
      const variable = result.cost_composition.find(
        (c) => c.category === 'variable',
      );

      expect(fixed).toBeDefined();
      expect(fixed!.total).toBe(23000000);
      expect(fixed!.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account_item_name: '給料手当' }),
          expect.objectContaining({ account_item_name: '地代家賃' }),
        ]),
      );

      expect(variable).toBeDefined();
      expect(variable!.total).toBe(8000000);
      expect(variable!.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account_item_name: '外注費' }),
          expect.objectContaining({ account_item_name: '広告宣伝費' }),
        ]),
      );

      expect(result.total_expense).toBe(31000000);
    });

    it('should support custom threshold', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 400000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 300000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
        threshold: 30,
      });

      expect(result.anomalies.length).toBe(1);
      expect(result.threshold).toBe(30);
    });

    it('should handle specific month analysis', async () => {
      const currentPl = makePl([
        {
          account_item_name: '売上原価',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '仕入高',
          hierarchy_level: 1,
          closing_balance: 1000000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '売上原価',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '仕入高',
          hierarchy_level: 1,
          closing_balance: 500000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
        month: 12,
      });

      expect(result.month).toBe(12);
      expect(mock).toHaveBeenCalledWith(123, {
        fiscal_year: 2024,
        start_month: 12,
        end_month: 12,
      });
      expect(mock).toHaveBeenCalledWith(123, {
        fiscal_year: 2023,
        start_month: 12,
        end_month: 12,
      });
    });

    it('should flag new expense items with no previous year baseline', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '新規コンサル費',
          hierarchy_level: 1,
          closing_balance: 2000000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
      });

      expect(result.anomalies.length).toBe(1);
      expect(result.anomalies[0].account_item_name).toBe('新規コンサル費');
      expect(result.anomalies[0].change_percentage).toBeNull();
      expect(result.anomalies[0].previous_amount).toBe(0);
      expect(result.anomalies[0].current_amount).toBe(2000000);
    });

    it('should return correct summary', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 800000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 300000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
      });

      expect(result.summary).toContain('2024年度累計の費用構造分析');
      expect(result.summary).toContain('異常検知1件');
      expect(result.fiscal_year).toBe(2024);
      expect(result.month).toBeNull();
    });

    it('should skip zero-balance items', async () => {
      const currentPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        { account_item_name: '交際費', hierarchy_level: 1, closing_balance: 0 },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 1000000,
        },
      ]);

      const previousPl = makePl([
        {
          account_item_name: '販売費及び一般管理費',
          hierarchy_level: 0,
          closing_balance: 0,
        },
        {
          account_item_name: '交際費',
          hierarchy_level: 1,
          closing_balance: 500000,
        },
        {
          account_item_name: '外注費',
          hierarchy_level: 1,
          closing_balance: 1000000,
        },
      ]);

      const mock = jest
        .fn<any>()
        .mockResolvedValueOnce(currentPl)
        .mockResolvedValueOnce(previousPl);

      const client = createClient(mock);
      const result: CostAnalysisResult = await client.getCostAnalysis(123, {
        fiscal_year: 2024,
      });

      expect(result.total_expense).toBe(1000000);
      expect(
        result.cost_composition
          .flatMap((c) => c.items)
          .map((i) => i.account_item_name),
      ).toEqual(['外注費']);
    });
  });
});
