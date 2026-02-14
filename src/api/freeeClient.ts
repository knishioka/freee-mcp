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
  FreeeInvoice,
  FreeeTrialBalance,
  FreeeApiError,
  DealAggregation,
  PartnerAggregation,
  MonthlyAggregation,
  AccountItemAggregation,
  InvoiceSummaryAggregation,
  InvoiceStatusAggregation,
  InvoicePartnerAggregation,
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

  // Note: Cash Flow Statement API (/reports/trial_cf) is not available in freee API
}
