#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function debugApi() {
  console.log('🔍 Debug API calls...\n');
  
  try {
    // Load tokens
    const tokenData = await fs.readFile('./tokens.json', 'utf-8');
    const tokens = JSON.parse(tokenData);
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      console.log('❌ No tokens found');
      return;
    }
    
    const [companyId, tokenInfo] = tokens[0];
    console.log(`Using company ID: ${companyId}`);
    console.log(`Access token: ${tokenInfo.access_token.substring(0, 10)}...`);
    console.log(`Token expires at: ${new Date(tokenInfo.expires_at * 1000).toLocaleString()}`);
    console.log(`Token type: ${tokenInfo.token_type}`);
    console.log(`Scope: ${tokenInfo.scope}\n`);
    
    // Test direct API call
    console.log('Testing direct API call to /companies...');
    
    try {
      const response = await axios.get('https://api.freee.co.jp/api/1/companies', {
        headers: {
          'Authorization': `Bearer ${tokenInfo.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ API call successful!');
      console.log(`Status: ${response.status}`);
      console.log(`Found ${response.data.companies.length} companies:`);
      response.data.companies.forEach(c => {
        console.log(`  - ${c.display_name} (ID: ${c.id})`);
      });
      
    } catch (error) {
      console.log('❌ API call failed');
      console.log(`Status: ${error.response?.status}`);
      console.log(`Status text: ${error.response?.statusText}`);
      console.log(`Headers:`, JSON.stringify(error.response?.headers, null, 2));
      console.log(`Data:`, JSON.stringify(error.response?.data, null, 2));
      
      // Try token refresh
      if (error.response?.status === 401 && tokenInfo.refresh_token) {
        console.log('\n🔄 Attempting token refresh...');
        
        try {
          const refreshResponse = await axios.post(
            'https://accounts.secure.freee.co.jp/public_api/token',
            new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.FREEE_CLIENT_ID,
              client_secret: process.env.FREEE_CLIENT_SECRET,
              refresh_token: tokenInfo.refresh_token
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
          
          console.log('✅ Token refresh successful!');
          const newTokens = refreshResponse.data;
          console.log(`New access token: ${newTokens.access_token.substring(0, 10)}...`);
          
          // Test with new token
          console.log('\n🔄 Testing with new token...');
          const retryResponse = await axios.get('https://api.freee.co.jp/api/1/companies', {
            headers: {
              'Authorization': `Bearer ${newTokens.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Retry successful!');
          console.log(`Found ${retryResponse.data.companies.length} companies`);
          
        } catch (refreshError) {
          console.log('❌ Token refresh failed');
          console.log(`Refresh error:`, refreshError.response?.data || refreshError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugApi().catch(console.error);