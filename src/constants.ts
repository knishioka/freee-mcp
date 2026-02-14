/**
 * Application-wide constants
 */

// API Configuration
export const FREEE_API_BASE_URL = 'https://api.freee.co.jp/api/1';
export const FREEE_AUTH_BASE_URL = 'https://accounts.secure.freee.co.jp';

// Token Configuration
export const TOKEN_EXPIRY_BUFFER_SECONDS = 300; // 5 minutes
export const TOKEN_NEAR_EXPIRY_THRESHOLD_SECONDS = 1800; // 30 minutes

// API Rate Limits
export const API_RATE_LIMIT_PER_HOUR = 3600;

// Default Values
export const DEFAULT_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

// Retry Configuration
export const MAX_API_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_COMPANY_ID: 'Company ID is required for this operation',
  INVALID_TOKEN: 'Authentication token is invalid or expired',
  TOKEN_REFRESH_FAILED: 'Failed to refresh authentication token',
  API_ERROR: 'freee API Error',
  NETWORK_ERROR: 'Network error occurred while calling freee API',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later.',
} as const;

// Tool Name Prefixes
export const TOOL_PREFIX = 'freee_' as const;

// MCP Server Configuration
export const SERVER_NAME = 'freee-mcp';
export const SERVER_VERSION = '0.1.0';
