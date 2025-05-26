#!/usr/bin/env node

import readline from 'readline';
import { spawn } from 'child_process';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('freee MCP Authentication Setup');
  console.log('==============================\n');

  // Check for existing tokens
  const tokenPath = process.env.TOKEN_STORAGE_PATH || path.join(process.cwd(), 'tokens.json');
  let existingTokens = false;
  
  try {
    await fs.access(tokenPath);
    const data = await fs.readFile(tokenPath, 'utf-8');
    const tokens = JSON.parse(data);
    if (tokens.length > 0) {
      existingTokens = true;
      console.log(`Found existing tokens at: ${tokenPath}`);
      const useExisting = await question('Use existing tokens? (y/n): ');
      if (useExisting.toLowerCase() === 'y') {
        console.log('\nExisting tokens retained. Setup complete!');
        rl.close();
        return;
      }
    }
  } catch (e) {
    // No existing tokens
  }

  // Get credentials from env or prompt
  let clientId = process.env.FREEE_CLIENT_ID;
  let clientSecret = process.env.FREEE_CLIENT_SECRET;
  
  if (clientId && clientSecret) {
    console.log('Using credentials from .env file');
    console.log(`Client ID: ${clientId.substring(0, 10)}...`);
  } else {
    console.log('No .env file found or credentials missing.');
    clientId = await question('Enter your freee Client ID: ');
    clientSecret = await question('Enter your freee Client Secret: ');
  }
  
  // Generate auth URL
  const authUrl = `https://accounts.secure.freee.co.jp/public_api/authorize?client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code`;
  
  console.log('\nPlease visit this URL to authorize the application:');
  console.log(authUrl);
  
  // Try to open in browser
  try {
    const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(start, [authUrl], { detached: true });
  } catch (e) {
    // Ignore errors, user can copy-paste manually
  }
  
  console.log('\nAfter authorizing, you will see an authorization code.');
  const authCode = await question('Enter the authorization code: ');
  
  // Exchange for tokens
  console.log('\nExchanging authorization code for tokens...');
  
  try {
    const tokenResponse = await axios.post(
      'https://accounts.secure.freee.co.jp/public_api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const tokens = tokenResponse.data;
    console.log('\nTokens obtained successfully!');
    
    // Get companies
    const companiesResponse = await axios.get(
      'https://api.freee.co.jp/api/1/companies',
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      }
    );
    
    const companies = companiesResponse.data.companies;
    console.log(`\nFound ${companies.length} companies:`);
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.display_name} (ID: ${company.id})`);
    });
    
    let companyId;
    if (companies.length === 1) {
      companyId = companies[0].id;
      console.log(`\nUsing company: ${companies[0].display_name}`);
    } else {
      const selection = await question('\nSelect company number: ');
      companyId = companies[parseInt(selection) - 1].id;
    }
    
    // Save tokens
    const saveToFile = await question('\nSave tokens to file? (y/n): ');
    
    if (saveToFile.toLowerCase() === 'y') {
      const tokenData = [[
        companyId,
        {
          ...tokens,
          expires_at: tokens.created_at + tokens.expires_in
        }
      ]];
      
      const filePath = tokenPath;
      await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));
      console.log(`\nTokens saved to: ${filePath}`);
    }
    
    // Display environment variables
    console.log('\nTo use these tokens with environment variables, add to your Claude Desktop config:');
    console.log('\n```json');
    console.log(JSON.stringify({
      env: {
        FREEE_CLIENT_ID: clientId,
        FREEE_CLIENT_SECRET: clientSecret,
        FREEE_ACCESS_TOKEN: tokens.access_token,
        FREEE_REFRESH_TOKEN: tokens.refresh_token,
        FREEE_COMPANY_ID: companyId.toString()
      }
    }, null, 2));
    console.log('```');
    
  } catch (error) {
    console.error('\nError:', error.response?.data || error.message);
    process.exit(1);
  }
  
  rl.close();
}

main().catch(console.error);