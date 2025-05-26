import { promises as fs } from 'fs';
import path from 'path';
import { FreeeTokenResponse } from '../types/freee.js';

export interface TokenData extends FreeeTokenResponse {
  expires_at: number;
}

export class TokenManager {
  private tokens: Map<number, TokenData> = new Map();
  private storagePath?: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath;
  }

  async loadTokens(): Promise<void> {
    if (!this.storagePath) return;

    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const tokenArray: Array<[number, TokenData]> = JSON.parse(data);
      this.tokens = new Map(tokenArray);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty tokens
      this.tokens = new Map();
    }
  }

  async saveTokens(): Promise<void> {
    if (!this.storagePath) return;

    const tokenArray = Array.from(this.tokens.entries());
    const dir = path.dirname(this.storagePath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.storagePath,
        JSON.stringify(tokenArray, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  async setToken(companyId: number, tokenResponse: FreeeTokenResponse): Promise<void> {
    const tokenData: TokenData = {
      ...tokenResponse,
      expires_at: tokenResponse.created_at + tokenResponse.expires_in
    };
    
    this.tokens.set(companyId, tokenData);
    await this.saveTokens();
  }

  getToken(companyId: number): TokenData | undefined {
    return this.tokens.get(companyId);
  }

  isTokenExpired(token: TokenData): boolean {
    const now = Math.floor(Date.now() / 1000);
    // Consider token expired 5 minutes before actual expiry
    return token.expires_at <= now + 300;
  }

  isTokenNearExpiry(token: TokenData): boolean {
    const now = Math.floor(Date.now() / 1000);
    // Check if token expires within 30 minutes
    return token.expires_at <= now + 1800;
  }

  getTokenExpiryStatus(token: TokenData): { status: 'valid' | 'near_expiry' | 'expired'; remainingMinutes: number } {
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = token.expires_at - now;
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    
    if (remainingSeconds <= 0) {
      return { status: 'expired', remainingMinutes: 0 };
    } else if (remainingMinutes <= 30) {
      return { status: 'near_expiry', remainingMinutes };
    } else {
      return { status: 'valid', remainingMinutes };
    }
  }

  async removeToken(companyId: number): Promise<void> {
    this.tokens.delete(companyId);
    await this.saveTokens();
  }

  getAllCompanyIds(): number[] {
    return Array.from(this.tokens.keys());
  }
}