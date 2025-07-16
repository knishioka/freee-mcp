import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { FreeeTokenResponse } from '../types/freee.js';

export interface TokenData extends FreeeTokenResponse {
  expires_at: number;
}

export class TokenManager {
  private tokens: Map<number, TokenData> = new Map();
  private storagePath?: string;
  private encryptionKey?: Buffer;

  constructor(storagePath?: string) {
    this.storagePath = storagePath;
    // Generate encryption key from environment or create a deterministic one
    const secret = process.env.FREEE_TOKEN_ENCRYPTION_KEY || 'freee-mcp-default-key';
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  private async checkFilePermissions(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const mode = stats.mode & parseInt('777', 8);
      
      // Check if file is readable/writable only by owner (0600)
      if (mode !== parseInt('600', 8)) {
        console.error(`Warning: Token file permissions are ${mode.toString(8)}, should be 600`);
        // Try to fix permissions
        await fs.chmod(filePath, 0o600);
      }
    } catch (error) {
      // File doesn't exist yet, which is ok
    }
  }

  private encrypt(text: string): string {
    if (!this.encryptionKey) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')  }:${  authTag.toString('hex')  }:${  encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    if (!this.encryptionKey) return encryptedText;
    
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText; // Not encrypted
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async loadTokens(): Promise<void> {
    if (!this.storagePath) return;

    try {
      await this.checkFilePermissions(this.storagePath);
      const encryptedData = await fs.readFile(this.storagePath, 'utf-8');
      const data = this.decrypt(encryptedData);
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
      
      const data = JSON.stringify(tokenArray, null, 2);
      const encryptedData = this.encrypt(data);
      
      // Use secure temp file pattern
      const tempPath = `${this.storagePath}.${process.pid}.tmp`;
      await fs.writeFile(tempPath, encryptedData, { mode: 0o600 });
      
      // Atomic rename
      await fs.rename(tempPath, this.storagePath);
      
      // Ensure correct permissions
      await fs.chmod(this.storagePath, 0o600);
    } catch (error) {
      console.error('Failed to save tokens:', error);
      // Clean up temp file if it exists
      try {
        await fs.unlink(`${this.storagePath}.${process.pid}.tmp`);
      } catch {
        // Ignore cleanup errors
      }
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

  /**
   * Get secure storage path based on platform
   */
  static getDefaultStoragePath(): string {
    const platform = os.platform();
    const homeDir = os.homedir();
    
    switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'freee-mcp', 'tokens.enc');
    case 'win32': // Windows
      return path.join(process.env.APPDATA || homeDir, 'freee-mcp', 'tokens.enc');
    default: // Linux and others
      return path.join(homeDir, '.config', 'freee-mcp', 'tokens.enc');
    }
  }
}