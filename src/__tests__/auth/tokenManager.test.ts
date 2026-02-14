import { TokenManager, TokenData } from '../../auth/tokenManager.js';
import { FreeeTokenResponse } from '../../types/freee.js';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  const mockTokenResponse: FreeeTokenResponse = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expires_in: 21600,
    token_type: 'bearer',
    scope: 'read write',
    created_at: Math.floor(Date.now() / 1000),
  };

  beforeEach(() => {
    // Create TokenManager without storage path to test in-memory operations
    tokenManager = new TokenManager();
  });

  describe('token management', () => {
    it('should set and get token for a company', async () => {
      await tokenManager.setToken(123, mockTokenResponse);

      const token = tokenManager.getToken(123);
      expect(token).toBeDefined();
      expect(token?.access_token).toBe('test_access_token');
      expect(token?.refresh_token).toBe('test_refresh_token');
      expect(token?.expires_at).toBe(
        mockTokenResponse.created_at + mockTokenResponse.expires_in,
      );
    });

    it('should return undefined for non-existent company', () => {
      const token = tokenManager.getToken(999);
      expect(token).toBeUndefined();
    });

    it('should get all company IDs', async () => {
      await tokenManager.setToken(123, mockTokenResponse);
      await tokenManager.setToken(456, {
        ...mockTokenResponse,
        access_token: 'test_access_token_2',
      });

      const companyIds = tokenManager.getAllCompanyIds();
      expect(companyIds).toHaveLength(2);
      expect(companyIds).toContain(123);
      expect(companyIds).toContain(456);
    });

    it('should remove token for a company', async () => {
      await tokenManager.setToken(123, mockTokenResponse);
      expect(tokenManager.getToken(123)).toBeDefined();

      await tokenManager.removeToken(123);
      expect(tokenManager.getToken(123)).toBeUndefined();
    });
  });

  describe('token expiration', () => {
    it('should check if token is expired', () => {
      const expiredToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const validToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      expect(tokenManager.isTokenExpired(expiredToken)).toBe(true);
      expect(tokenManager.isTokenExpired(validToken)).toBe(false);
    });

    it('should check if token is near expiry', () => {
      const nearExpiryToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 200, // 3.3 minutes from now
      };

      const validToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 400, // 6.7 minutes from now
      };

      expect(tokenManager.isTokenExpired(nearExpiryToken)).toBe(true); // Within 5 minute threshold
      expect(tokenManager.isTokenExpired(validToken)).toBe(false);
    });

    it('should get token expiry status', () => {
      const expiredToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) - 3600,
      };

      const nearExpiryToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 600,
      };

      const validToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 7200,
      };

      expect(tokenManager.getTokenExpiryStatus(expiredToken).status).toBe(
        'expired',
      );
      expect(tokenManager.getTokenExpiryStatus(nearExpiryToken).status).toBe(
        'near_expiry',
      );
      expect(tokenManager.getTokenExpiryStatus(validToken).status).toBe(
        'valid',
      );
    });

    it('should use 5-minute buffer consistently in getTokenExpiryStatus', () => {
      // Token with 200 seconds remaining (within 5-minute buffer)
      const withinBufferToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 200,
      };

      // Should be 'expired' because within 300s buffer
      const status = tokenManager.getTokenExpiryStatus(withinBufferToken);
      expect(status.status).toBe('expired');

      // Should match isTokenExpired behavior
      expect(tokenManager.isTokenExpired(withinBufferToken)).toBe(true);
    });

    it('should report near_expiry just above the buffer threshold', () => {
      // Token with 301 seconds remaining (just outside 5-minute buffer)
      const justAboveBufferToken: TokenData = {
        ...mockTokenResponse,
        expires_at: Math.floor(Date.now() / 1000) + 301,
      };

      const status = tokenManager.getTokenExpiryStatus(justAboveBufferToken);
      expect(status.status).toBe('near_expiry');
      expect(tokenManager.isTokenExpired(justAboveBufferToken)).toBe(false);
    });
  });
});
