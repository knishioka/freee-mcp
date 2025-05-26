import axios, { AxiosInstance, AxiosError } from 'axios';
import { TokenManager } from '../auth/tokenManager.js';
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
  FreeeApiError
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
    tokenManager: TokenManager
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tokenManager = tokenManager;

    this.api = axios.create({
      baseURL: 'https://api.freee.co.jp/api/1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.authApi = axios.create({
      baseURL: 'https://accounts.secure.freee.co.jp',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Add request interceptor to add auth token
    this.api.interceptors.request.use(async (config) => {
      const companyId = config.params?.company_id;
      if (companyId) {
        const token = this.tokenManager.getToken(companyId);
        if (token && !this.tokenManager.isTokenExpired(token)) {
          config.headers.Authorization = `Bearer ${token.access_token}`;
        }
      }
      return config;
    });

    // Add response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      this.handleApiError.bind(this)
    );
  }

  private async handleApiError(error: AxiosError): Promise<never> {
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh
      const companyId = error.config?.params?.company_id;
      if (companyId) {
        const token = this.tokenManager.getToken(companyId);
        if (token?.refresh_token) {
          try {
            await this.refreshToken(companyId, token.refresh_token);
            // Retry the original request
            if (error.config) {
              return this.api.request(error.config);
            }
          } catch (refreshError) {
            // Refresh failed, remove token
            await this.tokenManager.removeToken(companyId);
          }
        }
      }
    }

    const apiError = error.response?.data as FreeeApiError;
    const errorMessage = apiError?.errors?.[0]?.messages?.join(', ') || error.message;
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
    
    return `https://accounts.secure.freee.co.jp/public_api/authorize?${params.toString()}`;
  }

  async getAccessToken(code: string): Promise<FreeeTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
    });

    const response = await this.authApi.post<FreeeTokenResponse>(
      '/public_api/token',
      params.toString()
    );

    return response.data;
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
      params.toString()
    );

    await this.tokenManager.setToken(companyId, response.data);
  }

  // Company methods
  async getCompanies(): Promise<FreeeCompany[]> {
    const response = await this.api.get<{ companies: FreeeCompany[] }>('/companies');
    return response.data.companies;
  }

  async getCompany(companyId: number): Promise<FreeeCompany> {
    const response = await this.api.get<{ company: FreeeCompany }>(
      `/companies/${companyId}`
    );
    return response.data.company;
  }

  // Deal methods
  async getDeals(companyId: number, params?: {
    partner_id?: number;
    account_item_id?: number;
    start_issue_date?: string;
    end_issue_date?: string;
    offset?: number;
    limit?: number;
  }): Promise<FreeeDeal[]> {
    const response = await this.api.get<{ deals: FreeeDeal[] }>('/deals', {
      params: { company_id: companyId, ...params }
    });
    return response.data.deals;
  }

  async getDeal(companyId: number, dealId: number): Promise<FreeeDeal> {
    const response = await this.api.get<{ deal: FreeeDeal }>(
      `/deals/${dealId}`,
      { params: { company_id: companyId } }
    );
    return response.data.deal;
  }

  async createDeal(companyId: number, deal: Omit<FreeeDeal, 'id' | 'company_id'>): Promise<FreeeDeal> {
    const response = await this.api.post<{ deal: FreeeDeal }>(
      '/deals',
      { company_id: companyId, ...deal }
    );
    return response.data.deal;
  }

  // Account Item methods
  async getAccountItems(companyId: number, accountCategory?: string): Promise<FreeeAccountItem[]> {
    const response = await this.api.get<{ account_items: FreeeAccountItem[] }>(
      '/account_items',
      { params: { company_id: companyId, account_category: accountCategory } }
    );
    return response.data.account_items;
  }

  // Partner methods
  async getPartners(companyId: number, params?: {
    name?: string;
    shortcut1?: string;
    offset?: number;
    limit?: number;
  }): Promise<FreeePartner[]> {
    const response = await this.api.get<{ partners: FreeePartner[] }>('/partners', {
      params: { company_id: companyId, ...params }
    });
    return response.data.partners;
  }

  async createPartner(companyId: number, partner: Omit<FreeePartner, 'id' | 'company_id' | 'available'>): Promise<FreeePartner> {
    const response = await this.api.post<{ partner: FreeePartner }>(
      '/partners',
      { company_id: companyId, ...partner }
    );
    return response.data.partner;
  }

  // Section methods
  async getSections(companyId: number): Promise<FreeeSection[]> {
    const response = await this.api.get<{ sections: FreeeSection[] }>('/sections', {
      params: { company_id: companyId }
    });
    return response.data.sections;
  }

  // Tag methods
  async getTags(companyId: number): Promise<FreeeTag[]> {
    const response = await this.api.get<{ tags: FreeeTag[] }>('/tags', {
      params: { company_id: companyId }
    });
    return response.data.tags;
  }

  // Invoice methods
  async getInvoices(companyId: number, params?: {
    partner_id?: number;
    invoice_status?: string;
    payment_status?: string;
    start_issue_date?: string;
    end_issue_date?: string;
    offset?: number;
    limit?: number;
  }): Promise<FreeeInvoice[]> {
    const response = await this.api.get<{ invoices: FreeeInvoice[] }>('/invoices', {
      params: { company_id: companyId, ...params }
    });
    return response.data.invoices;
  }

  async createInvoice(companyId: number, invoice: Omit<FreeeInvoice, 'id' | 'company_id' | 'invoice_number'>): Promise<FreeeInvoice> {
    const response = await this.api.post<{ invoice: FreeeInvoice }>(
      '/invoices',
      { company_id: companyId, ...invoice }
    );
    return response.data.invoice;
  }

  // Trial Balance methods
  async getTrialBalance(companyId: number, params: {
    fiscal_year: number;
    start_month: number;
    end_month: number;
  }): Promise<FreeeTrialBalance[]> {
    const response = await this.api.get<{ trial_balance: FreeeTrialBalance[] }>(
      '/reports/trial_bs',
      { params: { company_id: companyId, ...params } }
    );
    return response.data.trial_balance;
  }
}