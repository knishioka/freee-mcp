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
    start_month: 4,
    end_month: 3,
    created_at: '2024-01-01',
    balances,
    ...overrides,
  };
}

describe('FreeeClient Segment P&L Methods', () => {
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

  describe('getProfitLossBySections', () => {
    it('should call the sections endpoint with correct params', async () => {
      const balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 5000000,
        }),
        makeBalanceItem({
          account_item_name: '営業利益',
          closing_balance: 800000,
        }),
      ];

      // First call: getSections (auto-fetch when section_ids not provided)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          sections: [
            { id: 1, name: '営業部' },
            { id: 2, name: '管理部' },
          ],
        },
      });
      // Second call: trial_pl_sections
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_sections: makePLReport(balances) },
      });

      const result = await client.getProfitLossBySections(123, {
        fiscal_year: 2024,
        start_month: 4,
        end_month: 3,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl_sections',
        {
          params: {
            company_id: 123,
            fiscal_year: 2024,
            start_month: 4,
            end_month: 3,
            section_ids: '1,2',
          },
        },
      );
      expect(result.balances).toHaveLength(2);
      expect(result.balances[0].account_item_name).toBe('売上高');
      expect(result.balances[0].closing_balance).toBe(5000000);
    });

    it('should return FreeeTrialBalance structure', async () => {
      const balances = [makeBalanceItem()];
      // First call: getSections (auto-fetch when section_ids not provided)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { sections: [{ id: 1, name: '営業部' }] },
      });
      // Second call: trial_pl_sections
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_sections: makePLReport(balances) },
      });

      const result = await client.getProfitLossBySections(123, {
        fiscal_year: 2024,
        start_month: 1,
        end_month: 12,
      });

      expect(result).toHaveProperty('company_id');
      expect(result).toHaveProperty('fiscal_year');
      expect(result).toHaveProperty('start_month');
      expect(result).toHaveProperty('end_month');
      expect(result).toHaveProperty('balances');
    });
  });

  describe('getProfitLossBySegment', () => {
    it('should call segment_1 endpoint', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_segment_1_tags: makePLReport(balances) },
      });

      await client.getProfitLossBySegment(123, 1, {
        fiscal_year: 2024,
        start_month: 4,
        end_month: 3,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl_segment_1_tags',
        {
          params: {
            company_id: 123,
            fiscal_year: 2024,
            start_month: 4,
            end_month: 3,
          },
        },
      );
    });

    it('should call segment_2 endpoint', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_segment_2_tags: makePLReport(balances) },
      });

      await client.getProfitLossBySegment(123, 2, {
        fiscal_year: 2024,
        start_month: 4,
        end_month: 3,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl_segment_2_tags',
        {
          params: {
            company_id: 123,
            fiscal_year: 2024,
            start_month: 4,
            end_month: 3,
          },
        },
      );
    });

    it('should call segment_3 endpoint', async () => {
      const balances = [makeBalanceItem()];
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_segment_3_tags: makePLReport(balances) },
      });

      await client.getProfitLossBySegment(123, 3, {
        fiscal_year: 2024,
        start_month: 4,
        end_month: 3,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/reports/trial_pl_segment_3_tags',
        {
          params: {
            company_id: 123,
            fiscal_year: 2024,
            start_month: 4,
            end_month: 3,
          },
        },
      );
    });

    it('should return correct data from segment response', async () => {
      const balances = [
        makeBalanceItem({
          account_item_name: '売上高',
          closing_balance: 3200000,
        }),
        makeBalanceItem({
          account_item_name: '営業利益',
          closing_balance: 450000,
        }),
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { trial_pl_segment_1_tags: makePLReport(balances) },
      });

      const result = await client.getProfitLossBySegment(123, 1, {
        fiscal_year: 2024,
        start_month: 4,
        end_month: 3,
      });

      expect(result.balances).toHaveLength(2);
      expect(result.balances[1].account_item_name).toBe('営業利益');
      expect(result.balances[1].closing_balance).toBe(450000);
    });
  });
});
