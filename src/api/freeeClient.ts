import axios, { AxiosInstance, AxiosError } from 'axios';
import { TokenManager } from '../auth/tokenManager.js';
import { FREEE_API_BASE_URL, FREEE_AUTH_BASE_URL } from '../constants.js';
import {
  FreeeTokenResponse,
  FreeeCompany,
  FreeeDeal,
  FreeeAccountItem,
  FreeePartner,
  FreeeSection,
  FreeeTag,
  FreeeInvoice,
  FreeeTrialBalance,
  FreeeApiError,
} from '../types/freee.js';

export class FreeeClient {
  private api: AxiosInstance;
  private authApi: AxiosInstance;
  private tokenManager: TokenManager;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tokenManager: TokenManager,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tokenManager = tokenManager;

    this.api = axios.create({
      baseURL: FREEE_API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.authApi = axios.create({
      baseURL: FREEE_AUTH_BASE_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Add request interceptor to add auth token
    this.api.interceptors.request.use(async (config) => {
      let companyId = config.params?.company_id;

      // Try to extract company_id from URL if not in params
      if (!companyId && config.url) {
        const companyMatch = config.url.match(/\/companies\/(\d+)/);
        if (companyMatch) {
          companyId = parseInt(companyMatch[1]);
        }
      }

      let token;
      if (companyId) {
        // Use company-specific token
        token = this.tokenManager.getToken(companyId);
      } else {
        // For endpoints that don't require company_id, use any available token
        const companyIds = this.tokenManager.getAllCompanyIds();
        if (companyIds.length > 0) {
          token = this.tokenManager.getToken(companyIds[0]);
        }
      }

      if (token) {
        const expiryStatus = this.tokenManager.getTokenExpiryStatus(token);

        if (expiryStatus.status === 'expired') {
          console.error(
            `Token for company ${companyId} has expired. Attempting refresh...`,
          );
          if (token.refresh_token) {
            try {
              await this.refreshToken(
                companyId || this.tokenManager.getAllCompanyIds()[0],
                token.refresh_token,
              );
              const refreshedToken = this.tokenManager.getToken(
                companyId || this.tokenManager.getAllCompanyIds()[0],
              );
              if (refreshedToken) {
                config.headers.Authorization = `Bearer ${refreshedToken.access_token}`;
              }
            } catch (error) {
              console.error('Pre-request token refresh failed:', error);
              throw new Error(
                'Authentication tokens have expired. Please run "npm run setup-auth" to re-authenticate.',
              );
            }
          } else {
            throw new Error(
              'Authentication tokens have expired. Please run "npm run setup-auth" to re-authenticate.',
            );
          }
        } else if (expiryStatus.status === 'near_expiry') {
          console.error(
            `Token for company ${companyId} expires in ${expiryStatus.remainingMinutes} minutes`,
          );
          config.headers.Authorization = `Bearer ${token.access_token}`;
        } else {
          config.headers.Authorization = `Bearer ${token.access_token}`;
        }
      }

      return config;
    });

    // Add response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      this.handleApiError.bind(this),
    );
  }

  private async handleApiError(error: AxiosError): Promise<never> {
    if (error.response?.status === 401) {
      // Check for specific freee API error codes
      const errorData = error.response?.data as any;
      const isExpiredToken = errorData?.code === 'expired_access_token';
      const errorCode = errorData?.code || 'unknown';

      console.error('\n=== Authentication Error (401) ===');
      console.error(`Error code: ${errorCode}`);
      console.error(
        `Type: ${isExpiredToken ? 'Token expired' : 'Unauthorized'}`,
      );

      // Token might be expired, try to refresh
      let companyId = error.config?.params?.company_id;

      // Try to extract company_id from URL if not in params
      if (!companyId && error.config?.url) {
        const companyMatch = error.config.url.match(/\/companies\/(\d+)/);
        if (companyMatch) {
          companyId = parseInt(companyMatch[1]);
        }
      }

      // If no company_id in params or URL, try to get the first available company
      if (!companyId) {
        const companyIds = this.tokenManager.getAllCompanyIds();
        if (companyIds.length > 0) {
          companyId = companyIds[0];
        }
      }

      if (companyId) {
        const token = this.tokenManager.getToken(companyId);
        if (token?.refresh_token) {
          try {
            console.error(
              `\nAttempting automatic token refresh for company ${companyId}...`,
            );
            await this.refreshToken(companyId, token.refresh_token);
            // Retry the original request
            if (error.config) {
              console.error(
                'Token refreshed successfully. Retrying original request...',
              );
              const retryResult = await this.api.request(error.config);
              return retryResult as never;
            }
          } catch (refreshError: any) {
            const refreshErrorData = refreshError.response?.data;
            console.error('\n=== Token Refresh Failed ===');
            console.error(
              'Error:',
              refreshErrorData?.error || refreshError.message,
            );

            // Refresh failed, remove token
            await this.tokenManager.removeToken(companyId);

            // CIRCUIT BREAKER: Prevent recursive error messages
            const baseErrorMessage =
              refreshErrorData?.error_description ||
              refreshError.message ||
              'Unknown error';
            const isRecursiveError = baseErrorMessage.includes(
              'Token refresh failed:',
            );

            if (isRecursiveError) {
              throw new Error(
                'Authentication expired. Please re-authenticate using freee_get_auth_url.',
              );
            }

            // If refresh token is also invalid, suggest re-authentication
            if (refreshErrorData?.error === 'invalid_grant') {
              console.error(
                '\nRefresh token is no longer valid. This can happen when:',
              );
              console.error(
                '1. The refresh token has already been used (freee tokens are single-use)',
              );
              console.error('2. The OAuth app permissions have changed');
              console.error('3. The token has been revoked');
              console.error('\nTo fix this issue:');
              console.error(
                '1. Use the freee_get_auth_url tool to get a new authorization URL',
              );
              console.error('2. Visit the URL and authorize the application');
              console.error(
                '3. Use freee_get_access_token with the authorization code',
              );
              console.error(
                '\nFor automated environments, see MCP_AUTHENTICATION.md',
              );
              throw new Error(
                'Authentication expired. Please re-authenticate using freee_get_auth_url.',
              );
            }

            throw new Error(`Token refresh failed: ${baseErrorMessage}`);
          }
        } else {
          console.error(
            '\nNo refresh token available. Please re-authenticate.',
          );
          throw new Error(
            'No refresh token available. Use freee_get_auth_url to re-authenticate.',
          );
        }
      } else {
        console.error(
          '\nNo company ID found for authentication. Please ensure you have authenticated at least once.',
        );
        throw new Error(
          'No authenticated companies found. Use freee_get_auth_url to authenticate.',
        );
      }
    }

    // Handle other API errors
    if (error.response?.status === 403) {
      console.error('\n=== Permission Error (403) ===');
      console.error(
        'The OAuth app does not have permission for this operation.',
      );
      console.error('Please check your freee OAuth app settings and scopes.');
    } else if (error.response?.status === 429) {
      console.error('\n=== Rate Limit Error (429) ===');
      console.error(
        'You have exceeded the freee API rate limit (3,600 requests/hour).',
      );
      console.error('Please wait before making more requests.');
    }

    const apiError = error.response?.data as FreeeApiError;
    const errorMessage =
      apiError?.errors?.[0]?.messages?.join(', ') || error.message;
    throw new Error(`freee API Error: ${errorMessage}`);
  }

  // Auth methods
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
    });

    if (state) {
      params.append('state', state);
    }

    return `${FREEE_AUTH_BASE_URL}/public_api/authorize?${params.toString()}`;
  }

  async getAccessToken(code: string): Promise<FreeeTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    try {
      console.error('🔄 Making token request to freee API...');
      const response = await this.authApi.post<FreeeTokenResponse>(
        '/public_api/token',
        params.toString(),
      );
      console.error('✅ Token request successful');
      return response.data;
    } catch (error: any) {
      console.error(
        '❌ Token request failed:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async refreshToken(companyId: number, refreshToken: string): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await this.authApi.post<FreeeTokenResponse>(
      '/public_api/token',
      params.toString(),
    );

    await this.tokenManager.setToken(companyId, response.data);
  }

  // Company methods
  async getCompanies(): Promise<FreeeCompany[]> {
    const response = await this.api.get<{ companies: FreeeCompany[] }>(
      '/companies',
    );
    return response.data.companies;
  }

  async getCompany(companyId: number): Promise<FreeeCompany> {
    const response = await this.api.get<{ company: FreeeCompany }>(
      `/companies/${companyId}`,
    );
    return response.data.company;
  }

  // Deal methods
  async getDeals(
    companyId: number,
    params?: {
      partner_id?: number;
      account_item_id?: number;
      start_issue_date?: string;
      end_issue_date?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeDeal[]> {
    const response = await this.api.get<{ deals: FreeeDeal[] }>('/deals', {
      params: { company_id: companyId, ...params },
    });
    return response.data.deals;
  }

  async getDeal(companyId: number, dealId: number): Promise<FreeeDeal> {
    const response = await this.api.get<{ deal: FreeeDeal }>(
      `/deals/${dealId}`,
      { params: { company_id: companyId } },
    );
    return response.data.deal;
  }

  async createDeal(
    companyId: number,
    deal: Omit<FreeeDeal, 'id' | 'company_id'>,
  ): Promise<FreeeDeal> {
    const response = await this.api.post<{ deal: FreeeDeal }>('/deals', {
      company_id: companyId,
      ...deal,
    });
    return response.data.deal;
  }

  // Account Item methods
  async getAccountItems(
    companyId: number,
    accountCategory?: string,
  ): Promise<FreeeAccountItem[]> {
    const response = await this.api.get<{ account_items: FreeeAccountItem[] }>(
      '/account_items',
      { params: { company_id: companyId, account_category: accountCategory } },
    );
    return response.data.account_items;
  }

  // Partner methods
  async getPartners(
    companyId: number,
    params?: {
      name?: string;
      shortcut1?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeePartner[]> {
    const response = await this.api.get<{ partners: FreeePartner[] }>(
      '/partners',
      {
        params: { company_id: companyId, ...params },
      },
    );
    return response.data.partners;
  }

  async createPartner(
    companyId: number,
    partner: Omit<FreeePartner, 'id' | 'company_id' | 'available'>,
  ): Promise<FreeePartner> {
    const response = await this.api.post<{ partner: FreeePartner }>(
      '/partners',
      { company_id: companyId, ...partner },
    );
    return response.data.partner;
  }

  // Section methods
  async getSections(companyId: number): Promise<FreeeSection[]> {
    const response = await this.api.get<{ sections: FreeeSection[] }>(
      '/sections',
      {
        params: { company_id: companyId },
      },
    );
    return response.data.sections;
  }

  // Tag methods
  async getTags(companyId: number): Promise<FreeeTag[]> {
    const response = await this.api.get<{ tags: FreeeTag[] }>('/tags', {
      params: { company_id: companyId },
    });
    return response.data.tags;
  }

  // Invoice methods
  async getInvoices(
    companyId: number,
    params?: {
      partner_id?: number;
      invoice_status?: string;
      payment_status?: string;
      start_issue_date?: string;
      end_issue_date?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeInvoice[]> {
    const response = await this.api.get<{ invoices: FreeeInvoice[] }>(
      '/invoices',
      {
        params: { company_id: companyId, ...params },
      },
    );
    return response.data.invoices;
  }

  async createInvoice(
    companyId: number,
    invoice: Omit<FreeeInvoice, 'id' | 'company_id' | 'invoice_number'>,
  ): Promise<FreeeInvoice> {
    const response = await this.api.post<{ invoice: FreeeInvoice }>(
      '/invoices',
      { company_id: companyId, ...invoice },
    );
    return response.data.invoice;
  }

  // Trial Balance methods
  async getTrialBalance(
    companyId: number,
    params: {
      fiscal_year: number;
      start_month: number;
      end_month: number;
    },
  ): Promise<FreeeTrialBalance> {
    const response = await this.api.get<{ trial_bs: FreeeTrialBalance }>(
      '/reports/trial_bs',
      { params: { company_id: companyId, ...params } },
    );
    return response.data.trial_bs;
  }

  // Profit & Loss Statement methods
  async getProfitLoss(
    companyId: number,
    params: {
      fiscal_year: number;
      start_month: number;
      end_month: number;
      breakdown_display_type?: 'partner' | 'item' | 'section' | 'tag' | null;
    },
  ): Promise<FreeeTrialBalance> {
    const response = await this.api.get<{ trial_pl: FreeeTrialBalance }>(
      '/reports/trial_pl',
      { params: { company_id: companyId, ...params } },
    );
    return response.data.trial_pl;
  }

  // Balance Sheet methods
  async getBalanceSheet(
    companyId: number,
    params: {
      fiscal_year: number;
      start_month: number;
      end_month: number;
      breakdown_display_type?: 'partner' | 'item' | 'section' | 'tag' | null;
    },
  ): Promise<FreeeTrialBalance> {
    const response = await this.api.get<{ trial_bs: FreeeTrialBalance }>(
      '/reports/trial_bs',
      { params: { company_id: companyId, ...params } },
    );
    return response.data.trial_bs;
  }

  // Note: Cash Flow Statement API (/reports/trial_cf) is not available in freee API
}
