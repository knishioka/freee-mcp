#!/usr/bin/env node

// Debug script to check token storage and loading
import path from 'path';
import fs from 'fs';
import { TokenManager } from './dist/auth/tokenManager.js';

async function debugTokens() {
  console.log('=== Token Debug Information ===');
  
  // Check environment variables
  console.log('\n1. Environment Variables:');
  console.log('FREEE_CLIENT_ID:', process.env.FREEE_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('FREEE_CLIENT_SECRET:', process.env.FREEE_CLIENT_SECRET ? '✅ Set' : '❌ Missing'); 
  console.log('FREEE_TOKEN_ENCRYPTION_KEY:', process.env.FREEE_TOKEN_ENCRYPTION_KEY ? '✅ Set' : '❌ Missing');
  console.log('TOKEN_STORAGE_PATH:', process.env.TOKEN_STORAGE_PATH || 'Using default');

  // Initialize TokenManager
  const tokenManager = new TokenManager();
  const defaultPath = TokenManager.getDefaultStoragePath();
  
  console.log('\n2. Storage Configuration:');
  console.log('Default storage path:', defaultPath);
  console.log('Storage path exists:', fs.existsSync(defaultPath));
  
  if (fs.existsSync(defaultPath)) {
    const stats = fs.statSync(defaultPath);
    console.log('File size:', stats.size, 'bytes');
    console.log('File permissions:', (stats.mode & parseInt('777', 8)).toString(8));
    console.log('Modified:', stats.mtime);
  }

  // Try to load tokens
  console.log('\n3. Token Loading:');
  try {
    await tokenManager.loadTokens();
    const companyIds = tokenManager.getAllCompanyIds();
    console.log('Loaded company IDs:', companyIds);
    
    for (const companyId of companyIds) {
      const token = tokenManager.getToken(companyId);
      if (token) {
        const expiryStatus = tokenManager.getTokenExpiryStatus(token);
        console.log(`Company ${companyId}:`, {
          hasAccessToken: !!token.access_token,
          hasRefreshToken: !!token.refresh_token,
          status: expiryStatus.status,
          remainingMinutes: expiryStatus.remainingMinutes
        });
      }
    }
  } catch (error) {
    console.error('Error loading tokens:', error.message);
  }
}

// Set environment variables from Claude Desktop config
process.env.FREEE_CLIENT_ID = "REDACTED-CLIENT-ID";
process.env.FREEE_CLIENT_SECRET = "REDACTED-CLIENT-SECRET";
process.env.FREEE_TOKEN_ENCRYPTION_KEY = "freee-claude-desktop-secure-2025";

debugTokens().catch(console.error);