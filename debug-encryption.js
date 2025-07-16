#!/usr/bin/env node

import fs from 'fs';
import crypto from 'crypto';
import { TokenManager } from './dist/auth/tokenManager.js';

// Set environment variables to match Claude Desktop
process.env.FREEE_CLIENT_ID = "608004353178974";
process.env.FREEE_CLIENT_SECRET = "5lVW94AuNFSmDd8oLdQzUxk1pGC3hTGtw615jXJ8tdNyL0hzHVA52NgChMWs0vPauIXrFC-AW4IV_5KoEDihOQ";
process.env.FREEE_TOKEN_ENCRYPTION_KEY = "freee-claude-desktop-secure-2025";

async function debugEncryption() {
  console.log('=== Encryption Debug ===');
  
  const tokenManager = new TokenManager();
  const storagePath = TokenManager.getDefaultStoragePath();
  
  console.log('\n1. File Content:');
  try {
    const encryptedContent = fs.readFileSync(storagePath, 'utf-8');
    console.log('Encrypted content length:', encryptedContent.length);
    console.log('Content starts with:', encryptedContent.substring(0, 50));
    
    // Check if it looks like encrypted format (hex:hex:hex)
    const parts = encryptedContent.split(':');
    console.log('Number of colon-separated parts:', parts.length);
    
    if (parts.length === 3) {
      console.log('IV length:', parts[0].length);
      console.log('AuthTag length:', parts[1].length);
      console.log('Encrypted data length:', parts[2].length);
    }
  } catch (error) {
    console.error('Error reading file:', error.message);
  }

  console.log('\n2. Encryption Key:');
  const secret = process.env.FREEE_TOKEN_ENCRYPTION_KEY || 'freee-mcp-default-key';
  const encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  console.log('Key source:', secret);
  console.log('Generated key:', encryptionKey.toString('hex'));

  console.log('\n3. Manual Decryption Test:');
  try {
    await tokenManager.loadTokens();
    const companyIds = tokenManager.getAllCompanyIds();
    console.log('Successfully loaded company IDs:', companyIds);
  } catch (error) {
    console.error('Load tokens failed:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n4. Test Encryption/Decryption:');
  try {
    // Create a new TokenManager and test basic encryption
    const testData = JSON.stringify([[12345, { test: 'data' }]]);
    console.log('Test data:', testData);
    
    // Create new instance to test encryption
    const testManager = new TokenManager('/tmp/test-tokens.enc');
    await testManager.setToken(12345, {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read write',
      created_at: Math.floor(Date.now() / 1000)
    });
    
    console.log('Test encryption successful');
    
    // Test loading
    const testManager2 = new TokenManager('/tmp/test-tokens.enc');
    await testManager2.loadTokens();
    const testCompanyIds = testManager2.getAllCompanyIds();
    console.log('Test decryption successful, company IDs:', testCompanyIds);
    
    // Clean up
    fs.unlinkSync('/tmp/test-tokens.enc');
    
  } catch (error) {
    console.error('Test encryption failed:', error.message);
  }
}

debugEncryption().catch(console.error);