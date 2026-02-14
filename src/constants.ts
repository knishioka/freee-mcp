/**
 * Application-wide constants
 */

// API Configuration
export const FREEE_API_BASE_URL = 'https://api.freee.co.jp/api/1';
export const FREEE_AUTH_BASE_URL = 'https://accounts.secure.freee.co.jp';

// Token Configuration
export const TOKEN_EXPIRY_BUFFER_SECONDS = 300; // 5 minutes
export const TOKEN_NEAR_EXPIRY_THRESHOLD_SECONDS = 1800; // 30 minutes

// Cache TTL (milliseconds)
export const CACHE_TTL_ACCOUNT_ITEMS = 15 * 60 * 1000; // 15 minutes
export const CACHE_TTL_SECTIONS = 15 * 60 * 1000; // 15 minutes
export const CACHE_TTL_TAGS = 15 * 60 * 1000; // 15 minutes
export const CACHE_TTL_PARTNERS = 5 * 60 * 1000; // 5 minutes
export const CACHE_TTL_COMPANIES = 30 * 60 * 1000; // 30 minutes

// MCP Server Configuration
export const SERVER_NAME = 'freee-mcp';
