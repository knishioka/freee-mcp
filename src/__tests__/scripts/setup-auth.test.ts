import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { TokenManager } from '../../auth/tokenManager.js';

const execFileAsync = promisify(execFile);

// __dirname is provided by ts-jest even in ESM mode (import.meta.url is not supported by ts-jest's TS compiler)

// Path to the setup-auth.js script
const SCRIPT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'setup-auth.js',
);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('setup-auth.js script', () => {
  let scriptSource: string;

  beforeAll(async () => {
    scriptSource = await fs.readFile(SCRIPT_PATH, 'utf-8');
  });

  describe('source code correctness', () => {
    it('should dynamically import TokenManager from compiled dist output', () => {
      // Acceptance Criteria #6: Setup script successfully imports TokenManager from compiled output
      // The script uses dynamic import after the build guard check
      expect(scriptSource).toMatch(
        /await\s+import\s*\(\s*pathToFileURL\s*\(\s*tokenManagerPath\s*\)\s*\.href\s*\)/,
      );
      // The tokenManagerPath variable points to dist/auth/tokenManager.js
      expect(scriptSource).toMatch(
        /tokenManagerPath\s*=\s*path\.join\(\s*[\s\S]*?dist[\s\S]*?auth[\s\S]*?tokenManager\.js/,
      );
    });

    it('should destructure TokenManager from the dynamic import', () => {
      // Acceptance Criteria #6: TokenManager is properly extracted from the import
      expect(scriptSource).toMatch(
        /const\s*\{\s*TokenManager\s*\}\s*=\s*await\s+import\s*\(\s*pathToFileURL\s*\(\s*tokenManagerPath\s*\)\s*\.href\s*\)/,
      );
    });

    it('should use TokenManager.getDefaultStoragePath() for default token path', () => {
      // Acceptance Criteria #2: Default storage path matches TokenManager.getDefaultStoragePath()
      expect(scriptSource).toContain('TokenManager.getDefaultStoragePath()');
    });

    it('should resolve token path from env variable or TokenManager default', () => {
      // Acceptance Criteria #2: path resolution with TOKEN_STORAGE_PATH fallback
      expect(scriptSource).toMatch(
        /process\.env\.TOKEN_STORAGE_PATH\s*\|\|\s*TokenManager\.getDefaultStoragePath\(\)/,
      );
    });

    it('should use tokenManager.setToken() for storing tokens (not fs.writeFile)', () => {
      // Acceptance Criteria #1 & #5: Tokens saved via setup-auth are encrypted via TokenManager
      // Verify setToken is used for token storage
      expect(scriptSource).toMatch(/tokenManager\.setToken\(/);

      // Ensure no direct fs.writeFile to the token file path
      // The script does use fs.appendFile for .env file, which is fine.
      // But there should be NO fs.writeFile/fs.writeFileSync that writes token data directly.
      const lines = scriptSource.split('\n');
      const tokenWriteViolations = lines.filter((line) => {
        // Skip comments
        if (line.trim().startsWith('//')) return false;
        // Look for fs.writeFile that writes to tokenPath
        if (line.includes('fs.writeFile') && line.includes('tokenPath'))
          return true;
        if (line.includes('fs.writeFileSync') && line.includes('tokenPath'))
          return true;
        if (line.includes('fs.writeFile') && line.includes('tokens.json'))
          return true;
        if (line.includes('fs.writeFileSync') && line.includes('tokens.json'))
          return true;
        return false;
      });
      expect(tokenWriteViolations).toHaveLength(0);
    });

    it('should not write plain text JSON tokens to any file', () => {
      // Acceptance Criteria #5: No plain text tokens written to tokens.json file
      // Ensure the script never references tokens.json as a write target
      expect(scriptSource).not.toMatch(/tokens\.json/);

      // Ensure no JSON.stringify of token data written directly to a file
      const lines = scriptSource.split('\n');
      const plainTextTokenWrites = lines.filter((line) => {
        if (line.trim().startsWith('//')) return false;
        // Check for patterns like: fs.writeFile(..., JSON.stringify(tokens))
        return (
          line.includes('JSON.stringify') &&
          line.includes('tokens') &&
          (line.includes('writeFile') || line.includes('writeFileSync'))
        );
      });
      expect(plainTextTokenWrites).toHaveLength(0);
    });

    it('should instantiate TokenManager with the resolved token path', () => {
      // Acceptance Criteria #1: Tokens saved via setup-auth are encrypted and readable by server
      // The script must create a TokenManager with the same path derivation the server uses
      expect(scriptSource).toMatch(/new\s+TokenManager\s*\(\s*tokenPath\s*\)/);
    });

    it('should check for existing encrypted tokens before prompting', () => {
      // Acceptance Criteria #4: Existing encrypted tokens detected and prompted for reuse
      expect(scriptSource).toContain('tokenManager.loadTokens()');
      expect(scriptSource).toContain('tokenManager.getAllCompanyIds()');
    });

    it('should prompt user about existing tokens when found', () => {
      // Acceptance Criteria #4: prompt for reuse
      expect(scriptSource).toMatch(/Use existing tokens\?/);
      expect(scriptSource).toContain('Found existing encrypted tokens');
    });

    it('should include build guard that checks for dist/auth/tokenManager.js', () => {
      // Acceptance Criteria #3: Clear error when dist/ directory doesn't exist
      // The build guard uses fs.access with the tokenManagerPath variable
      expect(scriptSource).toMatch(/fs\.access\(\s*tokenManagerPath\s*\)/);
    });

    it('should exit with error message when build output is missing', () => {
      // Acceptance Criteria #3: clear error message
      expect(scriptSource).toContain('Run "npm run build" first.');
      expect(scriptSource).toMatch(/process\.exit\(1\)/);
    });

    it('should run build guard before dynamic import of TokenManager', () => {
      // Acceptance Criteria #3: The build guard must run BEFORE the import
      // so users get a friendly error message instead of a raw import error
      const guardIndex = scriptSource.indexOf('fs.access(tokenManagerPath)');
      const importIndex = scriptSource.indexOf(
        'await import(pathToFileURL(tokenManagerPath).href)',
      );
      expect(guardIndex).toBeGreaterThan(-1);
      expect(importIndex).toBeGreaterThan(-1);
      expect(guardIndex).toBeLessThan(importIndex);
    });

    it('should store tokens for each company via tokenManager.setToken()', () => {
      // Acceptance Criteria #1: encrypted storage for all companies
      // Verify the for...of loop pattern that stores tokens per company
      expect(scriptSource).toMatch(
        /for\s*\(\s*const\s+company\s+of\s+companies\s*\)/,
      );
      expect(scriptSource).toMatch(
        /await\s+tokenManager\.setToken\s*\(\s*company\.id\s*,\s*tokens\s*\)/,
      );
    });
  });

  describe('build guard behavior', () => {
    it('should fail with build guard message when dist/ does not exist', async () => {
      // Acceptance Criteria #3: Clear error when dist/ directory doesn't exist
      // The script uses dynamic import (await import()) AFTER an explicit fs.access
      // build guard. When dist/ is missing, fs.access fails and the script prints
      // a user-friendly error message before exiting with code 1.
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'setup-auth-test-'),
      );

      // Create a minimal scripts directory with a copy of setup-auth.js
      const scriptsDir = path.join(tmpDir, 'scripts');
      await fs.mkdir(scriptsDir);
      await fs.copyFile(SCRIPT_PATH, path.join(scriptsDir, 'setup-auth.js'));

      // Create a minimal package.json so node can resolve as ESM
      await fs.writeFile(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ type: 'module' }),
      );

      // Symlink node_modules from the project so third-party imports resolve
      await fs.symlink(
        path.join(PROJECT_ROOT, 'node_modules'),
        path.join(tmpDir, 'node_modules'),
      );

      // DO NOT create dist/ directory - this should trigger the build guard

      try {
        await execFileAsync('node', [path.join(scriptsDir, 'setup-auth.js')], {
          cwd: tmpDir,
          timeout: 10000,
          env: { ...process.env, NODE_NO_WARNINGS: '1' },
        });
        // Should not reach here
        throw new Error('Expected the script to exit with an error');
      } catch (error: any) {
        // The script should exit with code 1
        expect(error.code).toBe(1);
        // The build guard should print the user-friendly error message
        expect(error.stderr).toContain('Run "npm run build" first.');
      } finally {
        // Cleanup
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should have build guard structure with try/catch around fs.access and process.exit(1)', () => {
      // Acceptance Criteria #3: Verify the complete build guard code structure
      const guardPattern =
        /try\s*\{\s*\n?\s*await\s+fs\.access\(\s*tokenManagerPath\s*\)\s*;?\s*\n?\s*\}\s*catch\s*\{[\s\S]*?process\.exit\(1\)/;
      expect(scriptSource).toMatch(guardPattern);
    });
  });

  describe('TokenManager path compatibility', () => {
    it('should use the same default path as TokenManager.getDefaultStoragePath()', () => {
      // Acceptance Criteria #2: Default storage path matches TokenManager.getDefaultStoragePath()
      const defaultPath = TokenManager.getDefaultStoragePath();

      // Verify the path ends with tokens.enc (encrypted format, not tokens.json)
      expect(defaultPath).toMatch(/tokens\.enc$/);

      // Verify the path is platform-appropriate
      const platform = os.platform();
      if (platform === 'darwin') {
        expect(defaultPath).toContain(
          path.join('Library', 'Application Support', 'freee-mcp'),
        );
      } else if (platform === 'win32') {
        expect(defaultPath).toContain('freee-mcp');
      } else {
        expect(defaultPath).toContain(path.join('.config', 'freee-mcp'));
      }
    });

    it('should use tokens.enc extension (not tokens.json) for encrypted storage', () => {
      // Acceptance Criteria #5: No plain text tokens
      const defaultPath = TokenManager.getDefaultStoragePath();
      expect(defaultPath).not.toMatch(/\.json$/);
      expect(defaultPath).toMatch(/\.enc$/);
    });

    it('should honor TOKEN_STORAGE_PATH environment variable when set', () => {
      // Acceptance Criteria #2: env override works
      // The script source uses: process.env.TOKEN_STORAGE_PATH || TokenManager.getDefaultStoragePath()
      // This verifies the pattern exists
      const envPattern =
        /process\.env\.TOKEN_STORAGE_PATH\s*\|\|\s*TokenManager\.getDefaultStoragePath\(\)/;
      expect(scriptSource).toMatch(envPattern);
    });
  });

  describe('encryption round-trip with TokenManager', () => {
    it('should produce tokens readable by TokenManager when using setToken', async () => {
      // Acceptance Criteria #1: Tokens saved via setup-auth are encrypted AND readable by server
      // Simulate what setup-auth.js does: create TokenManager, setToken, then read back
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'token-test-'));
      const tokenPath = path.join(tmpDir, 'tokens.enc');

      const tokenManager = new TokenManager(tokenPath);
      const mockTokens = {
        access_token: 'test_access_token_12345',
        refresh_token: 'test_refresh_token_67890',
        expires_in: 21600,
        token_type: 'bearer' as const,
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      };

      // This is exactly what setup-auth.js does for each company
      await tokenManager.setToken(123, mockTokens);

      // Verify the file exists
      const fileExists = await fs
        .access(tokenPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify the file contents are NOT plain text JSON
      const rawContent = await fs.readFile(tokenPath, 'utf-8');
      expect(() => {
        const parsed = JSON.parse(rawContent);
        // If we can parse it as JSON, check it doesn't contain plain tokens
        if (typeof parsed === 'object' && parsed !== null) {
          const stringified = JSON.stringify(parsed);
          if (stringified.includes('test_access_token_12345')) {
            throw new Error('Tokens are stored in plain text!');
          }
        }
      }).toThrow(); // Should throw because content is encrypted, not valid JSON

      // Verify a new TokenManager can read the tokens back (server compatibility)
      const serverTokenManager = new TokenManager(tokenPath);
      await serverTokenManager.loadTokens();
      const loadedToken = serverTokenManager.getToken(123);

      expect(loadedToken).toBeDefined();
      expect(loadedToken?.access_token).toBe('test_access_token_12345');
      expect(loadedToken?.refresh_token).toBe('test_refresh_token_67890');

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should produce encrypted file content that does not contain plain text tokens', async () => {
      // Acceptance Criteria #5: No plain text tokens written
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'token-plaintext-test-'),
      );
      const tokenPath = path.join(tmpDir, 'tokens.enc');

      const tokenManager = new TokenManager(tokenPath);
      const mockTokens = {
        access_token: 'super_secret_access_token_abc123',
        refresh_token: 'super_secret_refresh_token_xyz789',
        expires_in: 21600,
        token_type: 'bearer' as const,
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      };

      await tokenManager.setToken(42, mockTokens);

      // Read the raw file and ensure tokens are not present in plain text
      const rawContent = await fs.readFile(tokenPath, 'utf-8');
      expect(rawContent).not.toContain('super_secret_access_token_abc123');
      expect(rawContent).not.toContain('super_secret_refresh_token_xyz789');

      // The encrypted content should be a hex-formatted string with colons
      // (format: iv:authTag:encryptedData)
      expect(rawContent).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should store tokens with 0600 permissions', async () => {
      // Security: tokens file should only be readable by owner
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'token-perm-test-'),
      );
      const tokenPath = path.join(tmpDir, 'tokens.enc');

      const tokenManager = new TokenManager(tokenPath);
      const mockTokens = {
        access_token: 'access_token_test',
        refresh_token: 'refresh_token_test',
        expires_in: 21600,
        token_type: 'bearer' as const,
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      };

      await tokenManager.setToken(1, mockTokens);

      const stats = await fs.stat(tokenPath);
      const permissions = stats.mode & 0o777;
      expect(permissions).toBe(0o600);

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should support multiple companies like the setup script does', async () => {
      // Acceptance Criteria #1: The script stores tokens for each company
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'token-multi-test-'),
      );
      const tokenPath = path.join(tmpDir, 'tokens.enc');

      const tokenManager = new TokenManager(tokenPath);
      const mockTokens = {
        access_token: 'shared_access_token',
        refresh_token: 'shared_refresh_token',
        expires_in: 21600,
        token_type: 'bearer' as const,
        scope: 'read write',
        created_at: Math.floor(Date.now() / 1000),
      };

      // Simulate what setup-auth.js does: store the same tokens for each company
      const companies = [
        { id: 100, display_name: 'Company A' },
        { id: 200, display_name: 'Company B' },
        { id: 300, display_name: 'Company C' },
      ];
      for (const company of companies) {
        await tokenManager.setToken(company.id, mockTokens);
      }

      // Verify all companies are stored and readable
      const readManager = new TokenManager(tokenPath);
      await readManager.loadTokens();

      const companyIds = readManager.getAllCompanyIds();
      expect(companyIds).toHaveLength(3);
      expect(companyIds).toContain(100);
      expect(companyIds).toContain(200);
      expect(companyIds).toContain(300);

      for (const company of companies) {
        const token = readManager.getToken(company.id);
        expect(token).toBeDefined();
        expect(token?.access_token).toBe('shared_access_token');
      }

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });
});
