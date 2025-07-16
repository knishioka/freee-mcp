#!/usr/bin/env node

import { TokenManager } from './dist/auth/tokenManager.js';

// Set environment variables to match Claude Desktop
process.env.FREEE_CLIENT_ID = "your-freee-client-id";
process.env.FREEE_CLIENT_SECRET = "your-freee-client-secret";
process.env.FREEE_TOKEN_ENCRYPTION_KEY = "freee-claude-desktop-secure-2025";

async function analyzeTokenExpiry() {
  console.log('=== Token Expiry Analysis ===');
  
  const tokenManager = new TokenManager();
  await tokenManager.loadTokens();
  
  const companyIds = tokenManager.getAllCompanyIds();
  console.log('\nCompany IDs found:', companyIds);
  
  if (companyIds.length === 0) {
    console.log('❌ No tokens found. Authentication needed.');
    return;
  }
  
  for (const companyId of companyIds) {
    const token = tokenManager.getToken(companyId);
    if (!token) continue;
    
    console.log(`\n=== Company ${companyId} ===`);
    console.log('Created at:', new Date(token.created_at * 1000).toISOString());
    console.log('Expires in:', token.expires_in, 'seconds');
    console.log('Expires at:', new Date(token.expires_at * 1000).toISOString());
    console.log('Current time:', new Date().toISOString());
    
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = token.expires_at - now;
    console.log('Time left:', timeLeft, 'seconds (', Math.floor(timeLeft / 60), 'minutes )');
    
    const expiryStatus = tokenManager.getTokenExpiryStatus(token);
    console.log('Status:', expiryStatus.status);
    console.log('Remaining minutes:', expiryStatus.remainingMinutes);
    
    console.log('Has refresh token:', !!token.refresh_token);
    if (token.refresh_token) {
      console.log('Refresh token:', token.refresh_token.substring(0, 20) + '...');
    }
    
    // Check the 5-minute buffer logic
    const isExpiredBy5Min = token.expires_at <= now + 300;
    console.log('Expired by 5-min buffer:', isExpiredBy5Min);
    
    // Check freee specific timing
    const createdTime = new Date(token.created_at * 1000);
    const expiresTime = new Date(token.expires_at * 1000);
    const actualDuration = (token.expires_at - token.created_at) / 3600; // hours
    console.log('Actual token duration:', actualDuration, 'hours');
  }
  
  // freee token lifecycle analysis
  console.log('\n=== freee Token Lifecycle ===');
  console.log('Expected duration: 6 hours (21600 seconds)');
  console.log('Auto-refresh trigger: 5 minutes before expiry');
  console.log('Near expiry warning: 30 minutes before expiry');
}

analyzeTokenExpiry().catch(console.error);