import axios, { AxiosInstance, AxiosError } from 'axios';
import createDebug from 'debug';
import { TokenManager } from '../auth/tokenManager.js';
import {
  FREEE_API_BASE_URL,
  FREEE_AUTH_BASE_URL,
  CACHE_TTL_ACCOUNT_ITEMS,
  CACHE_TTL_COMPANIES,
  CACHE_TTL_PARTNERS,
  CACHE_TTL_SECTIONS,
  CACHE_TTL_TAGS,
  CACHE_TTL_TAX_CODES,
  PAGINATION_LIMIT,
  MAX_AUTO_PAGINATION_RECORDS,
} from '../constants.js';
import { TokenRefreshError } from '../errors.js';
import {
  FreeeTokenResponse,
  FreeeCompany,
  FreeeDeal,
  FreeeAccountItem,
  FreeePartner,
  FreeeSection,
  FreeeTag,
  FreeeSegmentTag,
  FreeeInvoice,
  FreeeTrialBalance,
  FreeeTrialBalanceItem,
  FreeeWalletable,
  FreeeManualJournal,
  FreeeWalletTransaction,
  FreeeTaxCode,
  FreeeTransfer,
  FreeeExpenseApplication,
  FreeeApiError,
  DealAggregation,
  PartnerAggregation,
  MonthlyAggregation,
  AccountItemAggregation,
  InvoiceSummaryAggregation,
  InvoiceStatusAggregation,
  InvoicePartnerAggregation,
  PeriodComparisonResult,
  PeriodChange,
  PeriodHighlight,
  MonthlyMetrics,
  MonthlyTrendsResult,
  CashAccount,
  CashPositionResult,
} from '../types/freee.js';
import { ApiCache, generateCacheKey } from './cache.js';

const logAuth = createDebug('freee-mcp:auth');
const logClient = createDebug('freee-mcp:client');

export class FreeeClient {
  private api: AxiosInstance;
  private authApi: AxiosInstance;
  private tokenManager: TokenManager;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private refreshPromises: Map<number, Promise<void>> = new Map();
  private cache: ApiCache = new ApiCache();

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
        const effectiveCompanyId =
          companyId || this.tokenManager.getAllCompanyIds()[0];
        const expiryStatus = this.tokenManager.getTokenExpiryStatus(token);

        if (expiryStatus.status === 'expired') {
          logAuth(
            'Token for company %d has expired. Attempting refresh...',
            effectiveCompanyId,
          );
          if (token.refresh_token) {
            try {
              await this.refreshTokenWithLock(
                effectiveCompanyId,
                token.refresh_token,
              );
              const refreshedToken =
                this.tokenManager.getToken(effectiveCompanyId);
              if (refreshedToken) {
                config.headers.Authorization = `Bearer ${refreshedToken.access_token}`;
              }
            } catch (error) {
              logAuth('Pre-request token refresh failed: %O', error);
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
          logAuth(
            'Token for company %d expires in %d minutes',
            effectiveCompanyId,
            expiryStatus.remainingMinutes,
          );
          config.headers.Authorization = `Bearer ${token.access_token}`;
          // Fire-and-forget background refresh
          if (token.refresh_token) {
            this.refreshTokenWithLock(
              effectiveCompanyId,
              token.refresh_token,
            ).catch((err) =>
              logAuth('Background token refresh failed: %O', err),
            );
          }
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

      logAuth(
        'Authentication error (401): code=%s type=%s',
        errorCode,
        isExpiredToken ? 'Token expired' : 'Unauthorized',
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
          // Retry guard: prevent infinite 401 retry loops
          if ((error.config as any)?.__retried) {
            throw new Error(
              'Authentication failed after token refresh. Please re-authenticate.',
            );
          }

          try {
            logAuth(
              'Attempting automatic token refresh for company %d...',
              companyId,
            );
            await this.refreshTokenWithLock(companyId, token.refresh_token);
            // Retry the original request
            if (error.config) {
              (error.config as any).__retried = true;
              logAuth(
                'Token refreshed successfully. Retrying original request...',
              );
              const retryResult = await this.api.request(error.config);
              return retryResult as never;
            }
          } catch (refreshError: any) {
            const refreshErrorData = refreshError.response?.data;
            logAuth(
              'Token refresh failed: %s',
              refreshErrorData?.error || refreshError.message,
            );

            // On invalid_grant, re-check token state before deleting
            // Another concurrent refresh may have succeeded
            if (refreshErrorData?.error === 'invalid_grant') {
              const currentToken = this.tokenManager.getToken(companyId);
              if (
                currentToken &&
                currentToken.access_token !== token.access_token
              ) {
                // Token was refreshed by another request, retry with new token
                logAuth('Token was refreshed by another request. Retrying...');
                if (error.config) {
                  const retryResult = await this.api.request(error.config);
                  return retryResult as never;
                }
              }

              // Token is genuinely invalid, remove and suggest re-auth
              await this.tokenManager.removeToken(companyId);
              logAuth(
                'Refresh token is no longer valid. Possible causes: (1) token already used (freee tokens are single-use), (2) OAuth app permissions changed, (3) token revoked. Re-authenticate using freee_get_auth_url.',
              );
              throw new Error(
                'Authentication expired. Please re-authenticate using freee_get_auth_url.',
              );
            }

            // Only delete tokens on definitive auth failures
            if (refreshErrorData?.error === 'invalid_client') {
              await this.tokenManager.removeToken(companyId);
            } else {
              // Transient error (network, timeout, etc.) — keep token for retry
              logAuth(
                'Token refresh failed (transient error), keeping existing token',
              );
            }

            // CIRCUIT BREAKER: Prevent recursive error messages
            if (refreshError instanceof TokenRefreshError) {
              throw new Error(
                'Authentication expired. Please re-authenticate using freee_get_auth_url.',
              );
            }

            const baseErrorMessage =
              refreshErrorData?.error_description ||
              refreshError.message ||
              'Unknown error';

            throw new TokenRefreshError(
              `Token refresh failed: ${baseErrorMessage}`,
              companyId,
            );
          }
        } else {
          logAuth('No refresh token available. Please re-authenticate.');
          throw new Error(
            'No refresh token available. Use freee_get_auth_url to re-authenticate.',
          );
        }
      } else {
        logAuth(
          'No company ID found for authentication. Please ensure you have authenticated at least once.',
        );
        throw new Error(
          'No authenticated companies found. Use freee_get_auth_url to authenticate.',
        );
      }
    }

    // Handle other API errors
    if (error.response?.status === 403) {
      logClient(
        'Permission error (403): The OAuth app does not have permission for this operation. Check freee OAuth app settings and scopes.',
      );
    } else if (error.response?.status === 429) {
      logClient(
        'Rate limit error (429): freee API rate limit exceeded (3,600 requests/hour). Please wait before making more requests.',
      );
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
      logAuth('Making token request to freee API...');
      const response = await this.authApi.post<FreeeTokenResponse>(
        '/public_api/token',
        params.toString(),
      );
      logAuth('Token request successful');
      return response.data;
    } catch (error: any) {
      logAuth(
        'Token request failed: %O',
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

  private async refreshTokenWithLock(
    companyId: number,
    refreshToken: string,
  ): Promise<void> {
    const existing = this.refreshPromises.get(companyId);
    if (existing) {
      return existing;
    }

    const refreshPromise = this.refreshToken(companyId, refreshToken).finally(
      () => {
        this.refreshPromises.delete(companyId);
      },
    );

    this.refreshPromises.set(companyId, refreshPromise);
    return refreshPromise;
  }

  // Company methods
  async getCompanies(): Promise<FreeeCompany[]> {
    const cacheKey = 'companies:all';
    const cached = this.cache.get<FreeeCompany[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ companies: FreeeCompany[] }>(
      '/companies',
    );
    const companies = response.data.companies;
    this.cache.set(cacheKey, companies, CACHE_TTL_COMPANIES);
    for (const company of companies) {
      this.cache.set(
        `${company.id}:company:details`,
        company,
        CACHE_TTL_COMPANIES,
      );
    }
    return companies;
  }

  async getCompany(companyId: number): Promise<FreeeCompany> {
    const cacheKey = `${companyId}:company:details`;
    const cached = this.cache.get<FreeeCompany>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ company: FreeeCompany }>(
      `/companies/${companyId}`,
    );
    this.cache.set(cacheKey, response.data.company, CACHE_TTL_COMPANIES);
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
    const cacheKey = generateCacheKey(companyId, 'account_items', {
      account_category: accountCategory,
    });
    const cached = this.cache.get<FreeeAccountItem[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ account_items: FreeeAccountItem[] }>(
      '/account_items',
      { params: { company_id: companyId, account_category: accountCategory } },
    );
    this.cache.set(
      cacheKey,
      response.data.account_items,
      CACHE_TTL_ACCOUNT_ITEMS,
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
    const cacheKey = generateCacheKey(companyId, 'partners', params);
    const cached = this.cache.get<FreeePartner[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ partners: FreeePartner[] }>(
      '/partners',
      {
        params: { company_id: companyId, ...params },
      },
    );
    this.cache.set(cacheKey, response.data.partners, CACHE_TTL_PARTNERS);
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
    this.cache.invalidate(`${companyId}:partners`);
    return response.data.partner;
  }

  // Section methods
  async getSections(companyId: number): Promise<FreeeSection[]> {
    const cacheKey = generateCacheKey(companyId, 'sections');
    const cached = this.cache.get<FreeeSection[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ sections: FreeeSection[] }>(
      '/sections',
      {
        params: { company_id: companyId },
      },
    );
    this.cache.set(cacheKey, response.data.sections, CACHE_TTL_SECTIONS);
    return response.data.sections;
  }

  // Tag methods
  async getTags(companyId: number): Promise<FreeeTag[]> {
    const cacheKey = generateCacheKey(companyId, 'tags');
    const cached = this.cache.get<FreeeTag[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ tags: FreeeTag[] }>('/tags', {
      params: { company_id: companyId },
    });
    this.cache.set(cacheKey, response.data.tags, CACHE_TTL_TAGS);
    return response.data.tags;
  }

  // Tax Code methods
  async getTaxCodes(companyId: number): Promise<FreeeTaxCode[]> {
    const cacheKey = generateCacheKey(companyId, 'tax_codes');
    const cached = this.cache.get<FreeeTaxCode[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ taxes: FreeeTaxCode[] }>(
      '/taxes/codes',
      { params: { company_id: companyId } },
    );
    this.cache.set(cacheKey, response.data.taxes, CACHE_TTL_TAX_CODES);
    return response.data.taxes;
  }

  // Segment Tag methods
  async getSegmentTags(
    companyId: number,
    segmentId: 1 | 2 | 3,
    params?: {
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeSegmentTag[]> {
    const cacheKey = generateCacheKey(
      companyId,
      `segment_${segmentId}_tags`,
      params,
    );
    const cached = this.cache.get<FreeeSegmentTag[]>(cacheKey);
    if (cached) return cached;

    const response = await this.api.get<{ segment_tags: FreeeSegmentTag[] }>(
      `/segments/${segmentId}/tags`,
      {
        params: { company_id: companyId, ...params },
      },
    );
    this.cache.set(cacheKey, response.data.segment_tags, CACHE_TTL_TAGS);
    return response.data.segment_tags;
  }

  async createSegmentTag(
    companyId: number,
    segmentId: 1 | 2 | 3,
    tag: {
      name: string;
      description?: string;
      shortcut1?: string;
      shortcut2?: string;
    },
  ): Promise<FreeeSegmentTag> {
    const response = await this.api.post<{ segment_tag: FreeeSegmentTag }>(
      `/segments/${segmentId}/tags`,
      { company_id: companyId, ...tag },
    );
    this.cache.invalidate(`${companyId}:segment_${segmentId}_tags`);
    return response.data.segment_tag;
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

  // Walletable methods
  async getWalletables(
    companyId: number,
    params?: {
      with_balance?: boolean;
    },
  ): Promise<FreeeWalletable[]> {
    const response = await this.api.get<{ walletables: FreeeWalletable[] }>(
      '/walletables',
      { params: { company_id: companyId, ...params } },
    );
    return response.data.walletables;
  }

  // Manual Journal methods
  async getManualJournals(
    companyId: number,
    params?: {
      start_issue_date?: string;
      end_issue_date?: string;
      entry_side?: string;
      account_item_id?: number;
      min_amount?: number;
      max_amount?: number;
      partner_id?: number;
      section_id?: number;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeManualJournal[]> {
    const response = await this.api.get<{
      manual_journals: FreeeManualJournal[];
    }>('/manual_journals', {
      params: { company_id: companyId, ...params },
    });
    return response.data.manual_journals;
  }

  async getManualJournal(
    companyId: number,
    manualJournalId: number,
  ): Promise<FreeeManualJournal> {
    const response = await this.api.get<{
      manual_journal: FreeeManualJournal;
    }>(`/manual_journals/${manualJournalId}`, {
      params: { company_id: companyId },
    });
    return response.data.manual_journal;
  }

  // Wallet Transaction methods
  async getWalletTxns(
    companyId: number,
    params?: {
      walletable_type?: string;
      walletable_id?: number;
      start_date?: string;
      end_date?: string;
      entry_side?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeWalletTransaction[]> {
    const response = await this.api.get<{
      wallet_txns: FreeeWalletTransaction[];
    }>('/wallet_txns', {
      params: { company_id: companyId, ...params },
    });
    return response.data.wallet_txns;
  }

  // Transfer methods
  async getTransfers(
    companyId: number,
    params?: {
      start_date?: string;
      end_date?: string;
      walletable_id?: number;
      walletable_type?: 'bank_account' | 'credit_card' | 'wallet';
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeTransfer[]> {
    const response = await this.api.get<{ transfers: FreeeTransfer[] }>(
      '/transfers',
      { params: { company_id: companyId, ...params } },
    );
    return response.data.transfers;
  }

  async getTransfer(
    companyId: number,
    transferId: number,
  ): Promise<FreeeTransfer> {
    const response = await this.api.get<{ transfer: FreeeTransfer }>(
      `/transfers/${transferId}`,
      { params: { company_id: companyId } },
    );
    return response.data.transfer;
  }

  async createTransfer(
    companyId: number,
    transfer: {
      date: string;
      amount: number;
      from_walletable_id: number;
      from_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
      to_walletable_id: number;
      to_walletable_type: 'bank_account' | 'credit_card' | 'wallet';
      description?: string;
    },
  ): Promise<FreeeTransfer> {
    const response = await this.api.post<{ transfer: FreeeTransfer }>(
      '/transfers',
      { company_id: companyId, ...transfer },
      { params: { company_id: companyId } },
    );
    return response.data.transfer;
  }

  // Expense Application methods
  async getExpenseApplications(
    companyId: number,
    params?: {
      status?: string;
      start_issue_date?: string;
      end_issue_date?: string;
      start_transaction_date?: string;
      end_transaction_date?: string;
      applicant_id?: number;
      approver_id?: number;
      min_amount?: number;
      max_amount?: number;
      offset?: number;
      limit?: number;
    },
  ): Promise<FreeeExpenseApplication[]> {
    const response = await this.api.get<{
      expense_applications: FreeeExpenseApplication[];
    }>('/expense_applications', {
      params: { company_id: companyId, ...params },
    });
    return response.data.expense_applications;
  }

  async getExpenseApplication(
    companyId: number,
    expenseApplicationId: number,
  ): Promise<FreeeExpenseApplication> {
    const response = await this.api.get<{
      expense_application: FreeeExpenseApplication;
    }>(`/expense_applications/${expenseApplicationId}`, {
      params: { company_id: companyId },
    });
    return response.data.expense_application;
  }

  async approveExpenseApplication(
    companyId: number,
    expenseApplicationId: number,
    params: {
      approval_action: string;
      target_step_id: number;
      target_round: number;
    },
  ): Promise<FreeeExpenseApplication> {
    const response = await this.api.post<{
      expense_application: FreeeExpenseApplication;
    }>(`/expense_applications/${expenseApplicationId}/actions`, {
      company_id: companyId,
      ...params,
    });
    return response.data.expense_application;
  }

  // Auto-pagination: fetches all pages of a paginated endpoint
  async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, unknown>,
    dataKey: string,
    maxRecords: number = MAX_AUTO_PAGINATION_RECORDS,
  ): Promise<T[]> {
    const allResults: T[] = [];
    let offset = 0;
    const limit = PAGINATION_LIMIT;
    let pageCount = 0;

    while (allResults.length < maxRecords) {
      const response = await this.api.get(endpoint, {
        params: { ...params, offset, limit },
      });
      const items: T[] = response.data[dataKey] || [];
      allResults.push(...items);
      pageCount++;

      if (pageCount > 1 && pageCount % 5 === 0) {
        logClient(
          'Auto-pagination: fetched %d records in %d API calls for %s',
          allResults.length,
          pageCount,
          endpoint,
        );
      }

      if (items.length < limit) break;
      offset += limit;
    }

    const truncated = allResults.length > maxRecords;
    if (truncated) {
      logClient(
        'Auto-pagination: results truncated at %d records for %s (total fetched: %d)',
        maxRecords,
        endpoint,
        allResults.length,
      );
    }

    return allResults.slice(0, maxRecords);
  }

  private wasTruncated(fetchedCount: number, maxRecords: number): boolean {
    return fetchedCount >= maxRecords;
  }

  // Search deals with server-side aggregation
  async searchDeals(
    companyId: number,
    filters: {
      partner_id?: number;
      account_item_id?: number;
      start_issue_date?: string;
      end_issue_date?: string;
    },
    maxRecords?: number,
  ): Promise<DealAggregation> {
    const params: Record<string, unknown> = { company_id: companyId };
    if (filters.partner_id) params.partner_id = filters.partner_id;
    if (filters.account_item_id)
      params.account_item_id = filters.account_item_id;
    if (filters.start_issue_date)
      params.start_issue_date = filters.start_issue_date;
    if (filters.end_issue_date) params.end_issue_date = filters.end_issue_date;

    const effectiveMax = maxRecords ?? MAX_AUTO_PAGINATION_RECORDS;
    const deals = await this.fetchAllPages<FreeeDeal>(
      '/deals',
      params,
      'deals',
      maxRecords,
    );

    const result = this.aggregateDeals(deals);
    if (this.wasTruncated(deals.length, effectiveMax)) {
      result.truncated = true;
      result.max_records_cap = effectiveMax;
    }
    return result;
  }

  private aggregateDeals(deals: FreeeDeal[]): DealAggregation {
    const sorted = [...deals].sort((a, b) =>
      a.issue_date.localeCompare(b.issue_date),
    );

    let totalIncome = 0;
    let totalExpense = 0;
    const partnerMap = new Map<
      number,
      { name: string; income: number; expense: number; count: number }
    >();
    const monthMap = new Map<
      string,
      { income: number; expense: number; count: number }
    >();
    const accountItemMap = new Map<number, { total: number; count: number }>();

    for (const deal of deals) {
      if (deal.type === 'income') {
        totalIncome += deal.amount;
      } else {
        totalExpense += deal.amount;
      }

      // By partner
      if (deal.partner_id != null) {
        const existing = partnerMap.get(deal.partner_id) || {
          name: deal.partner_name || `Partner ${deal.partner_id}`,
          income: 0,
          expense: 0,
          count: 0,
        };
        if (deal.type === 'income') existing.income += deal.amount;
        else existing.expense += deal.amount;
        existing.count++;
        partnerMap.set(deal.partner_id, existing);
      }

      // By month
      const month = deal.issue_date.substring(0, 7); // YYYY-MM
      const monthEntry = monthMap.get(month) || {
        income: 0,
        expense: 0,
        count: 0,
      };
      if (deal.type === 'income') monthEntry.income += deal.amount;
      else monthEntry.expense += deal.amount;
      monthEntry.count++;
      monthMap.set(month, monthEntry);

      // By account item
      for (const detail of deal.details || []) {
        const existing = accountItemMap.get(detail.account_item_id) || {
          total: 0,
          count: 0,
        };
        existing.total += detail.amount;
        existing.count++;
        accountItemMap.set(detail.account_item_id, existing);
      }
    }

    const byPartner: PartnerAggregation[] = Array.from(
      partnerMap.entries(),
    ).map(([id, data]) => ({
      partner_id: id,
      partner_name: data.name,
      income: data.income,
      expense: data.expense,
      count: data.count,
    }));

    const byMonth: MonthlyAggregation[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        count: data.count,
      }));

    const byAccountItem: AccountItemAggregation[] = Array.from(
      accountItemMap.entries(),
    ).map(([id, data]) => ({
      account_item_id: id,
      total: data.total,
      count: data.count,
    }));

    const result: DealAggregation = {
      total_count: deals.length,
      total_income: totalIncome,
      total_expense: totalExpense,
      by_partner: byPartner,
      by_month: byMonth,
      by_account_item: byAccountItem,
    };

    if (sorted.length > 0) {
      result.date_range = `${sorted[0].issue_date} to ${sorted[sorted.length - 1].issue_date}`;
    }

    return result;
  }

  // Summarize invoices with payment status breakdown
  async summarizeInvoices(
    companyId: number,
    filters: {
      partner_id?: number;
      invoice_status?: string;
      payment_status?: string;
      start_issue_date?: string;
      end_issue_date?: string;
    },
    maxRecords?: number,
  ): Promise<InvoiceSummaryAggregation> {
    const params: Record<string, unknown> = { company_id: companyId };
    if (filters.partner_id) params.partner_id = filters.partner_id;
    if (filters.invoice_status) params.invoice_status = filters.invoice_status;
    if (filters.payment_status) params.payment_status = filters.payment_status;
    if (filters.start_issue_date)
      params.start_issue_date = filters.start_issue_date;
    if (filters.end_issue_date) params.end_issue_date = filters.end_issue_date;

    const effectiveMax = maxRecords ?? MAX_AUTO_PAGINATION_RECORDS;
    const invoices = await this.fetchAllPages<FreeeInvoice>(
      '/invoices',
      params,
      'invoices',
      maxRecords,
    );

    const result = this.aggregateInvoices(invoices);
    if (this.wasTruncated(invoices.length, effectiveMax)) {
      result.truncated = true;
      result.max_records_cap = effectiveMax;
    }
    return result;
  }

  private aggregateInvoices(
    invoices: FreeeInvoice[],
  ): InvoiceSummaryAggregation {
    const sorted = [...invoices].sort((a, b) =>
      a.issue_date.localeCompare(b.issue_date),
    );

    const today = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
      .format(new Date())
      .replace(/\//g, '-');
    let totalAmount = 0;
    let unpaidAmount = 0;
    let overdueCount = 0;
    const statusMap = new Map<string, { count: number; amount: number }>();
    const partnerMap = new Map<
      number,
      { name: string; count: number; amount: number; unpaid: number }
    >();

    for (const invoice of invoices) {
      totalAmount += invoice.total_amount;

      const isUnpaid =
        invoice.payment_status === 'unsettled' ||
        invoice.payment_status === 'empty';
      if (isUnpaid) {
        unpaidAmount += invoice.total_amount;
        if (invoice.due_date && invoice.due_date < today) {
          overdueCount++;
        }
      }

      // By status (combine invoice_status and payment_status)
      const statusKey = `${invoice.invoice_status}/${invoice.payment_status || 'unknown'}`;
      const statusEntry = statusMap.get(statusKey) || {
        count: 0,
        amount: 0,
      };
      statusEntry.count++;
      statusEntry.amount += invoice.total_amount;
      statusMap.set(statusKey, statusEntry);

      // By partner
      const existing = partnerMap.get(invoice.partner_id) || {
        name: invoice.partner_name || `Partner ${invoice.partner_id}`,
        count: 0,
        amount: 0,
        unpaid: 0,
      };
      existing.count++;
      existing.amount += invoice.total_amount;
      if (isUnpaid) existing.unpaid += invoice.total_amount;
      partnerMap.set(invoice.partner_id, existing);
    }

    const byStatus: InvoiceStatusAggregation[] = Array.from(
      statusMap.entries(),
    ).map(([status, data]) => ({
      status,
      count: data.count,
      amount: data.amount,
    }));

    const byPartner: InvoicePartnerAggregation[] = Array.from(
      partnerMap.entries(),
    ).map(([id, data]) => ({
      partner_id: id,
      partner_name: data.name,
      count: data.count,
      amount: data.amount,
      unpaid: data.unpaid,
    }));

    const result: InvoiceSummaryAggregation = {
      total_count: invoices.length,
      total_amount: totalAmount,
      unpaid_amount: unpaidAmount,
      overdue_count: overdueCount,
      by_status: byStatus,
      by_partner: byPartner,
    };

    if (sorted.length > 0) {
      result.date_range = `${sorted[0].issue_date} to ${sorted[sorted.length - 1].issue_date}`;
    }

    return result;
  }

  // === Analysis methods ===

  async comparePeriods(
    companyId: number,
    reportType: 'profit_loss' | 'balance_sheet',
    period1: { fiscal_year: number; start_month: number; end_month: number },
    period2: { fiscal_year: number; start_month: number; end_month: number },
    breakdownDisplayType?: 'partner' | 'item' | 'section' | 'tag',
  ): Promise<PeriodComparisonResult> {
    const fetchReport =
      reportType === 'profit_loss'
        ? (p: typeof period1) =>
          this.getProfitLoss(companyId, {
            ...p,
            breakdown_display_type: breakdownDisplayType,
          })
        : (p: typeof period1) =>
          this.getBalanceSheet(companyId, {
            ...p,
            breakdown_display_type: breakdownDisplayType,
          });

    const [report1, report2] = await Promise.all([
      fetchReport(period1),
      fetchReport(period2),
    ]);

    const metrics1 = this.extractBalanceMetrics(report1.balances);
    const metrics2 = this.extractBalanceMetrics(report2.balances);

    const allItems = new Set([
      ...Object.keys(metrics1),
      ...Object.keys(metrics2),
    ]);
    const changes: Record<string, PeriodChange> = {};
    const intermediateHighlights: Array<
      PeriodHighlight & { absPercentage: number }
    > = [];

    for (const item of allItems) {
      const val1 = metrics1[item] ?? 0;
      const val2 = metrics2[item] ?? 0;
      const amount = val2 - val1;
      const percentage =
        val1 !== 0
          ? Math.round(((val2 - val1) / Math.abs(val1)) * 10000) / 100
          : val2 === val1
            ? 0
            : null;

      changes[item] = { amount, percentage };

      if (amount === 0) continue;

      const absPercentage = percentage !== null ? Math.abs(percentage) : 0;
      const significance: 'high' | 'medium' | 'low' =
        absPercentage > 10 ? 'high' : absPercentage > 5 ? 'medium' : 'low';

      if (significance !== 'low') {
        const changeStr =
          percentage !== null
            ? `${percentage >= 0 ? '+' : ''}${percentage}%`
            : 'new';
        intermediateHighlights.push({
          item,
          change: changeStr,
          significance,
          absPercentage,
        });
      }
    }

    intermediateHighlights.sort((a, b) => b.absPercentage - a.absPercentage);

    const highlights: PeriodHighlight[] = intermediateHighlights
      .slice(0, 10)
      .map(({ item, change, significance }) => ({
        item,
        change,
        significance,
      }));

    return {
      report_type: reportType,
      period1: { ...period1, metrics: metrics1 },
      period2: { ...period2, metrics: metrics2 },
      changes,
      highlights,
    };
  }

  async getMonthlyTrends(
    companyId: number,
    fiscalYear: number,
    reportType: 'profit_loss' | 'balance_sheet',
    months?: number[],
  ): Promise<MonthlyTrendsResult> {
    const targetMonths = months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const fetchReport =
      reportType === 'profit_loss'
        ? (m: number) =>
          this.getProfitLoss(companyId, {
            fiscal_year: fiscalYear,
            start_month: m,
            end_month: m,
          })
        : (m: number) =>
          this.getBalanceSheet(companyId, {
            fiscal_year: fiscalYear,
            start_month: m,
            end_month: m,
          });

    const reports = await Promise.all(targetMonths.map((m) => fetchReport(m)));

    const monthlyData: MonthlyMetrics[] = reports.map((report, i) => ({
      month: targetMonths[i],
      metrics: this.extractBalanceMetrics(report.balances),
    }));

    // Compute summary using first available metric as primary
    const allMetricNames =
      monthlyData.length > 0 ? Object.keys(monthlyData[0].metrics) : [];
    const primaryMetric = allMetricNames[0] ?? '';

    const primaryValues = monthlyData.map((m) => ({
      month: m.month,
      value: m.metrics[primaryMetric] ?? 0,
    }));

    const avg =
      primaryValues.length > 0
        ? Math.round(
          primaryValues.reduce((sum, v) => sum + v.value, 0) /
              primaryValues.length,
        )
        : 0;

    const max = primaryValues.reduce(
      (best, v) => (v.value > best.value ? v : best),
      primaryValues[0] ?? { month: 0, value: 0 },
    );

    const min = primaryValues.reduce(
      (best, v) => (v.value < best.value ? v : best),
      primaryValues[0] ?? { month: 0, value: 0 },
    );

    const trend = this.computeTrend(primaryValues.map((v) => v.value));

    return {
      fiscal_year: fiscalYear,
      report_type: reportType,
      months: monthlyData,
      summary: {
        primary_metric: primaryMetric,
        avg,
        max: { month: max.month, value: max.value },
        min: { month: min.month, value: min.value },
        trend,
      },
    };
  }

  async getCashPosition(companyId: number): Promise<CashPositionResult> {
    const today = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
      .format(new Date())
      .replace(/\//g, '-');

    const [walletables, unsettledInvoices, allDeals] = await Promise.all([
      this.getWalletables(companyId, { with_balance: true }),
      this.fetchAllPages<FreeeInvoice>(
        '/invoices',
        { company_id: companyId, payment_status: 'unsettled' },
        'invoices',
      ),
      this.fetchAllPages<FreeeDeal>(
        '/deals',
        { company_id: companyId },
        'deals',
      ),
    ]);

    // Cash from walletables (bank accounts and wallets, exclude credit cards)
    const accounts: CashAccount[] = walletables.map((w) => ({
      name: w.name,
      type: w.type,
      balance: w.walletable_balance ?? w.last_balance ?? 0,
    }));

    const totalCash = accounts
      .filter((a) => a.type !== 'credit_card')
      .reduce((sum, a) => sum + a.balance, 0);

    // Receivables from unsettled invoices and income deals
    const unsettledIncomes = allDeals.filter(
      (d) => d.type === 'income' && d.status !== 'settled',
    );
    const overdueInvoices = unsettledInvoices.filter(
      (i) => i.due_date && i.due_date < today,
    );
    const overdueIncomes = unsettledIncomes.filter(
      (d) => d.due_date && d.due_date < today,
    );
    const receivables = {
      total:
        unsettledInvoices.reduce((sum, i) => sum + i.total_amount, 0) +
        unsettledIncomes.reduce((sum, d) => sum + d.amount, 0),
      overdue:
        overdueInvoices.reduce((sum, i) => sum + i.total_amount, 0) +
        overdueIncomes.reduce((sum, d) => sum + d.amount, 0),
      count: unsettledInvoices.length + unsettledIncomes.length,
    };

    // Payables from unsettled expense deals
    const unsettledExpenses = allDeals.filter(
      (d) => d.type === 'expense' && d.status !== 'settled',
    );
    const overdueExpenses = unsettledExpenses.filter(
      (d) => d.due_date && d.due_date < today,
    );
    const payables = {
      total: unsettledExpenses.reduce((sum, d) => sum + d.amount, 0),
      overdue: overdueExpenses.reduce((sum, d) => sum + d.amount, 0),
      count: unsettledExpenses.length,
    };

    return {
      total_cash: totalCash,
      accounts,
      receivables,
      payables,
      net_position: totalCash + receivables.total - payables.total,
    };
  }

  private extractBalanceMetrics(
    balances: FreeeTrialBalanceItem[],
  ): Record<string, number> {
    const metrics: Record<string, number> = {};
    for (const item of balances) {
      if (item.account_item_name) {
        metrics[item.account_item_name] = item.closing_balance;
      }
    }
    return metrics;
  }

  private computeTrend(
    values: number[],
  ): 'increasing' | 'decreasing' | 'stable' | 'fluctuating' {
    if (values.length < 2) return 'stable';

    const thirdSize = Math.max(1, Math.floor(values.length / 3));
    const firstThird = values.slice(0, thirdSize);
    const lastThird = values.slice(-thirdSize);

    const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

    if (firstAvg === 0 && lastAvg === 0) return 'stable';
    if (firstAvg === 0) return lastAvg > 0 ? 'increasing' : 'decreasing';

    const changePercent = ((lastAvg - firstAvg) / Math.abs(firstAvg)) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';

    // Check for fluctuation via coefficient of variation
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg === 0) return 'stable';

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const cv = Math.sqrt(variance) / Math.abs(avg);

    if (cv > 0.2) return 'fluctuating';
    return 'stable';
  }

  // Note: Cash Flow Statement API (/reports/trial_cf) is not available in freee API
}
