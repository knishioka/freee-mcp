#!/usr/bin/env node

import readline from "readline";
import { spawn } from "child_process";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build guard: ensure compiled output exists
const tokenManagerPath = path.join(
  __dirname,
  "..",
  "dist",
  "auth",
  "tokenManager.js",
);
try {
  await fs.access(tokenManagerPath);
} catch {
  console.error('Error: Compiled code not found. Run "npm run build" first.');
  process.exit(1);
}

const { TokenManager } = await import(tokenManagerPath);

// Load .env file
dotenv.config();

async function main() {
  console.log("freee MCP Authentication Setup");
  console.log("==============================\n");

  // Check for existing tokens using TokenManager (encrypted storage)
  const tokenPath =
    process.env.TOKEN_STORAGE_PATH || TokenManager.getDefaultStoragePath();
  const tokenManager = new TokenManager(tokenPath);
  let existingTokens = false;

  try {
    await tokenManager.loadTokens();
    const existingCompanyIds = tokenManager.getAllCompanyIds();
    if (existingCompanyIds.length > 0) {
      existingTokens = true;
      console.log(
        `Found existing encrypted tokens for companies: ${existingCompanyIds.join(", ")}`,
      );

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const useExisting = await new Promise((resolve) =>
        rl.question("Use existing tokens? (Y/n): ", resolve),
      );
      rl.close();

      if (useExisting.toLowerCase() === "n") {
        // Continue to new authentication
      } else {
        console.log("\nExisting tokens retained. Setup complete!");
        process.exit(0);
      }
    }
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.warn(
        `\n⚠️  Warning: Could not load existing tokens (${e.message}). Starting fresh authentication...`,
      );
    }
  }

  // Get credentials from env or prompt
  let clientId = process.env.FREEE_CLIENT_ID;
  let clientSecret = process.env.FREEE_CLIENT_SECRET;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  const hiddenQuestion = (query) =>
    new Promise((resolve) => {
      // Check if we're in a TTY environment
      if (
        !process.stdin.isTTY ||
        typeof process.stdin.setRawMode !== "function"
      ) {
        // Fallback to regular input in non-interactive environments
        return question(query);
      }

      process.stdout.write(query);
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      let input = "";
      const onData = (char) => {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(input);
        } else if (char === "\u0003") {
          // Handle Ctrl+C
          process.exit();
        } else if (char === "\u007f" || char === "\b") {
          // Handle backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };

      stdin.on("data", onData);
    });

  try {
    if (clientId && clientSecret) {
      console.log("Using credentials from .env file");
      console.log(`Client ID: ${clientId.substring(0, 10)}...`);
    } else {
      console.log("No .env file found or credentials missing.");
      clientId = await question("Enter your freee Client ID: ");
      clientSecret = await hiddenQuestion("Enter your freee Client Secret: ");
    }

    // Generate auth URL
    const authUrl = `https://accounts.secure.freee.co.jp/public_api/authorize?client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code`;

    console.log("\nPlease visit this URL to authorize the application:");
    console.log(authUrl);

    // Try to open in browser
    try {
      const start =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      spawn(start, [authUrl], { detached: true });
    } catch (e) {
      // Ignore errors, user can copy-paste manually
    }

    console.log("\nAfter authorizing, you will see an authorization code.");
    const authCode = await hiddenQuestion("Enter the authorization code: ");

    // Exchange for tokens
    console.log("\nExchanging authorization code for tokens...");

    try {
      const tokenResponse = await axios.post(
        "https://accounts.secure.freee.co.jp/public_api/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: authCode,
          redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const tokens = tokenResponse.data;
      console.log("✅ Successfully obtained access token!");

      // Get companies
      console.log("\nFetching available companies...");
      const companiesResponse = await axios.get(
        "https://api.freee.co.jp/api/1/companies",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      const companies = companiesResponse.data.companies;
      console.log(`\nFound ${companies.length} companies:`);
      companies.forEach((company, index) => {
        console.log(
          `${index + 1}. ${company.display_name} (ID: ${company.id})`,
        );
      });

      // Store tokens for each company using TokenManager (encrypted)
      for (const company of companies) {
        await tokenManager.setToken(company.id, tokens);
      }

      console.log(`\n✅ Encrypted tokens saved to: ${tokenPath}`);
      console.log("\nSetup complete! You can now use the freee MCP server.");

      // Save credentials to .env if they weren't already there
      if (!process.env.FREEE_CLIENT_ID || !process.env.FREEE_CLIENT_SECRET) {
        const envPath = path.join(process.cwd(), ".env");
        const envContent = `FREEE_CLIENT_ID=${clientId}\nFREEE_CLIENT_SECRET=${clientSecret}\n`;

        try {
          let existingEnv = "";
          try {
            existingEnv = await fs.readFile(envPath, "utf-8");
          } catch (e) {
            // File doesn't exist
          }

          if (!existingEnv.includes("FREEE_CLIENT_ID")) {
            await fs.appendFile(envPath, envContent);
            console.log("✅ Credentials saved to .env file");
          }
        } catch (e) {
          console.error("Could not save credentials to .env:", e.message);
        }
      }
    } catch (error) {
      console.error("\n❌ Error:", error.response?.data || error.message);
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
