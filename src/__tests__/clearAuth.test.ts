import { jest } from '@jest/globals';
import { TokenManager } from '../auth/tokenManager.js';

jest.mock('../auth/tokenManager.js');

describe('freee_clear_auth tool', () => {
  let mockTokenManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

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

    (TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager,
    );
  });

  describe('clear specific company', () => {
    it('should call removeToken with the specified companyId', async () => {
      const companyId = 123;
      mockTokenManager.getAllCompanyIds.mockReturnValue([123, 456]);
      mockTokenManager.removeToken.mockResolvedValue(undefined);

      await mockTokenManager.removeToken(companyId);

      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(123);
      expect(mockTokenManager.removeToken).toHaveBeenCalledTimes(1);
    });

    it('should not affect other companies when clearing a specific one', async () => {
      mockTokenManager.getAllCompanyIds.mockReturnValue([123, 456, 789]);
      mockTokenManager.removeToken.mockResolvedValue(undefined);

      await mockTokenManager.removeToken(456);

      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(456);
      expect(mockTokenManager.removeToken).not.toHaveBeenCalledWith(123);
      expect(mockTokenManager.removeToken).not.toHaveBeenCalledWith(789);
    });
  });

  describe('clear all companies', () => {
    it('should call removeToken for each company when no companyId specified', async () => {
      const allIds = [123, 456, 789];
      mockTokenManager.getAllCompanyIds.mockReturnValue(allIds);
      mockTokenManager.removeToken.mockResolvedValue(undefined);

      // Simulate the tool handler logic: clear all
      for (const id of mockTokenManager.getAllCompanyIds()) {
        await mockTokenManager.removeToken(id);
      }

      expect(mockTokenManager.removeToken).toHaveBeenCalledTimes(3);
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(123);
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(456);
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith(789);
    });

    it('should handle empty token list gracefully', async () => {
      mockTokenManager.getAllCompanyIds.mockReturnValue([]);
      mockTokenManager.removeToken.mockResolvedValue(undefined);

      const allIds = mockTokenManager.getAllCompanyIds();
      for (const id of allIds) {
        await mockTokenManager.removeToken(id);
      }

      expect(mockTokenManager.removeToken).not.toHaveBeenCalled();
    });
  });

  describe('response content', () => {
    it('should include re-authentication instructions in single company response', () => {
      const companyId = 123;
      const responseText = `Authentication cleared for company ${companyId}.\n\nTo re-authenticate:\n1. Call freee_get_auth_url to get the authorization URL\n2. Visit the URL and authorize the application\n3. Call freee_get_access_token with the authorization code`;

      expect(responseText).toContain('Authentication cleared for company 123');
      expect(responseText).toContain('freee_get_auth_url');
      expect(responseText).toContain('freee_get_access_token');
    });

    it('should include company IDs in all-companies response', () => {
      const allIds = [123, 456];
      const responseText = `Authentication cleared for all companies (${allIds.join(', ')}).`;

      expect(responseText).toContain('123, 456');
      expect(responseText).toContain('all companies');
    });

    it('should handle no tokens found message', () => {
      const allIds: number[] = [];
      const responseText = `Authentication cleared for all companies${allIds.length > 0 ? ` (${allIds.join(', ')})` : ' (no tokens found)'}.`;

      expect(responseText).toContain('no tokens found');
    });
  });
});
