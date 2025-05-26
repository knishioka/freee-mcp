#!/usr/bin/env node

import { TokenManager } from '../dist/auth/tokenManager.js';
import { FreeeClient } from '../dist/api/freeeClient.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function simpleTest() {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('Missing FREEE_CLIENT_ID or FREEE_CLIENT_SECRET');
    process.exit(1);
  }
  
  const tokenManager = new TokenManager('./tokens.json');
  const freeeClient = new FreeeClient(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob', tokenManager);
  
  // Load existing tokens
  await tokenManager.loadTokens();
  const companyIds = tokenManager.getAllCompanyIds();
  
  if (companyIds.length === 0) {
    console.log('No tokens found. Please run "npm run setup-auth" first.');
    return;
  }
  
  console.log(`Found tokens for ${companyIds.length} companies: ${companyIds.join(', ')}`);
  
  try {
    console.log('\nCalling /companies endpoint...');
    const companies = await freeeClient.getCompanies();
    console.log(`✅ Success! Found ${companies.length} companies:`);
    companies.forEach(c => console.log(`   - ${c.display_name} (ID: ${c.id})`));
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

simpleTest().catch(console.error);