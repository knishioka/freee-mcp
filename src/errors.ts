/**
 * Custom error classes for better error handling
 */

export class FreeeApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FreeeApiError';
  }
}

export class AuthenticationError extends FreeeApiError {
  constructor(message: string, details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(public companyId: number) {
    super(`Token expired for company ${companyId}`);
    this.name = 'TokenExpiredError';
  }
}

export class ValidationError extends FreeeApiError {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends FreeeApiError {
  constructor(public retryAfter?: number) {
    super('API rate limit exceeded', 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if error is a FreeeApiError
 */
export function isFreeeApiError(error: unknown): error is FreeeApiError {
  return error instanceof FreeeApiError;
}

/**
 * Type guard to check if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Helper to create appropriate error from API response
 */
export function createApiError(response: any): FreeeApiError {
  const status = response?.status;
  const message = response?.data?.message || response?.data?.errors?.[0]?.messages?.join(', ') || 'Unknown error';
  const errorCode = response?.data?.code;

  switch (status) {
  case 401:
    return new AuthenticationError(message, response.data);
  case 429: {
    const retryAfter = response.headers?.['retry-after'];
    return new RateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
  }
  case 400:
    return new ValidationError(message);
  default:
    return new FreeeApiError(message, status, errorCode, response.data);
  }
}