#!/usr/bin/env node

import { TokenManager } from '../dist/auth/tokenManager.js';
import { FreeeClient } from '../dist/api/freeeClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testToken() {
  console.log('Testing freee MCP token configuration...\n');

  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const tokenStoragePath = process.env.TOKEN_STORAGE_PATH || path.join(__dirname, '..', 'tokens.json');

  if (!clientId || !clientSecret) {
    console.error('❌ FREEE_CLIENT_ID and FREEE_CLIENT_SECRET must be set in .env file');
    process.exit(1);
  }

  console.log('✅ Client credentials found');
  console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
  console.log(`   Token storage: ${tokenStoragePath}\n`);

  // Initialize components
  const tokenManager = new TokenManager(tokenStoragePath);
  const freeeClient = new FreeeClient(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob', tokenManager);

  // Load tokens
  console.log('Loading tokens...');
  await tokenManager.loadTokens();

  const companyIds = tokenManager.getAllCompanyIds();
  if (companyIds.length === 0) {
    console.error('❌ No tokens found. Please run "npm run setup-auth" first.');
    process.exit(1);
  }

  console.log(`✅ Found tokens for ${companyIds.length} companies\n`);

  // Check token expiration
  for (const companyId of companyIds) {
    const token = tokenManager.getToken(companyId);
    if (token) {
      const isExpired = tokenManager.isTokenExpired(token);
      const expiresAt = new Date(token.expires_at * 1000);
      console.log(`Company ${companyId}:`);
      console.log(`   Token expires at: ${expiresAt.toLocaleString()}`);
      console.log(`   Token status: ${isExpired ? '❌ Expired' : '✅ Valid'}`);
      
      if (isExpired && token.refresh_token) {
        console.log('   🔄 Attempting to refresh token...');
        try {
          await freeeClient.refreshToken(companyId, token.refresh_token);
          console.log('   ✅ Token refreshed successfully');
        } catch (error) {
          console.error('   ❌ Failed to refresh token:', error.message);
        }
      }
    }
  }

  // Test API call
  console.log('\nTesting API call to /companies...');
  try {
    const companies = await freeeClient.getCompanies();
    console.log(`✅ API call successful! Found ${companies.length} companies:`);
    companies.forEach(company => {
      console.log(`   - ${company.display_name} (ID: ${company.id})`);
    });
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    if (error.message.includes('401')) {
      console.error('\nAuthentication failed. Your token may be invalid or expired.');
      console.error('Please run "npm run setup-auth" to re-authenticate.');
    }
  }

  // Test company-specific API call
  console.log('\nTesting company-specific API calls...');
  
  // First, get all companies this token has access to
  const accessibleCompanies = await freeeClient.getCompanies();
  console.log(`Token has access to ${accessibleCompanies.length} companies`);
  
  // Try to access each company's details
  for (const company of accessibleCompanies) {
    try {
      console.log(`\nTesting API call for company ${company.id} (${company.display_name})...`);
      const companyDetails = await freeeClient.getCompany(company.id);
      console.log(`✅ Successfully accessed company ${companyDetails.id}`);
    } catch (error) {
      console.error(`❌ Failed to access company ${company.id}: ${error.message}`);
    }
  }

  console.log('\n✅ Token test complete!');
}

testToken().catch(console.error);