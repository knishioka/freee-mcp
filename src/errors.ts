/**
 * Custom error classes for error handling
 */

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public companyId?: number,
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}
