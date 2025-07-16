# MCP Authentication Guide

This guide provides comprehensive documentation for implementing authentication in Model Context Protocol (MCP) servers, with specific focus on OAuth 2.0, security best practices, and Claude Desktop integration.

## Table of Contents

1. [Security Best Practices](#security-best-practices)
2. [Authentication Patterns](#authentication-patterns)
3. [Token Storage Recommendations](#token-storage-recommendations)
4. [Claude Desktop Specific Considerations](#claude-desktop-specific-considerations)
5. [OAuth Implementation](#oauth-implementation)
6. [Development and Testing](#development-and-testing)
7. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

## Security Best Practices

### Core Security Requirements

MCP servers must implement robust security measures to protect user data and prevent unauthorized access:

1. **No Session-Based Authentication**
   - MCP servers MUST NOT use sessions for authentication
   - Each request must be independently authenticated
   - This prevents session hijacking and improves stateless operation

2. **Token Validation**
   - MCP servers MUST NOT accept tokens that were not explicitly issued for the MCP server
   - Validate token claims, audience, and metadata
   - Prevent "token passthrough" vulnerabilities

3. **Secure Token Handling**
   ```typescript
   // Good: Validate token is for this specific service
   if (tokenClaims.audience !== 'your-mcp-server-id') {
     throw new Error('Invalid token audience');
   }
   
   // Bad: Accepting any valid token without validation
   // This is the "token passthrough" anti-pattern
   ```

4. **Transport Security**
   - All authorization endpoints MUST be served over HTTPS
   - Redirect URIs MUST be either localhost URLs or HTTPS URLs
   - Never transmit tokens in URL query parameters

### OAuth 2.1 Requirements

MCP implementations should follow OAuth 2.1 specifications:

1. **PKCE (Proof Key for Code Exchange)**
   - Required for all OAuth flows, even confidential clients
   - Protects against authorization code interception attacks

2. **Token Rotation**
   - Implement automatic token refresh before expiration
   - Single-use refresh tokens (when supported by the provider)
   - Store token expiration timestamps

3. **Secure Random Generation**
   - Use cryptographically secure random number generators
   - For session IDs, state parameters, and PKCE verifiers

## Authentication Patterns

### OAuth Authorization Code Flow

The recommended flow for MCP servers with user interaction:

```javascript
// 1. Generate authorization URL
const authUrl = new URL('https://provider.com/oauth/authorize');
authUrl.searchParams.append('client_id', CLIENT_ID);
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('scope', 'required scopes');
authUrl.searchParams.append('state', generateSecureRandomState());

// 2. Exchange authorization code for tokens
const tokenResponse = await fetch('https://provider.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
  }),
});
```

### Token Refresh Strategy

Implement proactive token refresh to prevent authentication failures:

```typescript
class TokenManager {
  isTokenExpired(token: TokenData): boolean {
    const now = Math.floor(Date.now() / 1000);
    // Consider token expired 5 minutes before actual expiry
    return token.expires_at <= now + 300;
  }

  async refreshTokenIfNeeded(token: TokenData): Promise<TokenData> {
    if (this.isTokenExpired(token)) {
      return await this.refreshToken(token.refresh_token);
    }
    return token;
  }
}
```

### Multi-Tenant Support

For services that support multiple accounts or organizations:

```typescript
// Store tokens per tenant/company
class MultiTenantTokenManager {
  private tokens: Map<string, TokenData> = new Map();
  
  async setToken(tenantId: string, token: TokenData): Promise<void> {
    this.tokens.set(tenantId, token);
    await this.persistTokens();
  }
  
  getToken(tenantId: string): TokenData | undefined {
    return this.tokens.get(tenantId);
  }
}
```

## Token Storage Recommendations

### Storage Options Comparison

| Storage Method | Security | Persistence | Use Case |
|----------------|----------|-------------|----------|
| File System | Medium | Yes | Production with proper permissions |
| Environment Variables | Low | No | Development/Testing only |
| Encrypted File | High | Yes | Production (recommended) |
| In-Memory | High | No | Testing/Temporary sessions |

### File-Based Storage

Recommended approach for persistent token storage:

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { chmod } from 'fs/promises';

class SecureTokenStorage {
  private storagePath: string;
  
  async saveTokens(tokens: TokenData[]): Promise<void> {
    const dir = path.dirname(this.storagePath);
    
    // Create directory with restricted permissions
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    
    // Write file with restricted permissions
    await fs.writeFile(
      this.storagePath,
      JSON.stringify(tokens, null, 2),
      { mode: 0o600 }
    );
  }
  
  async loadTokens(): Promise<TokenData[]> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      throw error;
    }
  }
}
```

### Security Considerations

1. **File Permissions**
   - Set restrictive permissions (600) on token files
   - Store in user-specific directories
   - Never commit token files to version control

2. **Encryption at Rest**
   - Consider encrypting tokens before storage
   - Use system keychains when available
   - Implement key rotation strategies

3. **Token File Location**
   ```bash
   # Good locations:
   ~/.config/your-mcp-server/tokens.json  # Linux/macOS
   %APPDATA%\your-mcp-server\tokens.json  # Windows
   
   # Bad locations:
   ./tokens.json                           # Project directory
   /tmp/tokens.json                        # Temporary directory
   ```

## Claude Desktop Specific Considerations

### Configuration File Locations

Claude Desktop stores MCP server configurations in platform-specific locations:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Environment Variable Limitations

Claude Desktop has known issues with environment variables in the config:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        // WARNING: Environment variables may not be passed correctly
        // Consider alternative approaches
      }
    }
  }
}
```

### Workarounds for Environment Variables

1. **Command Line Approach** (Recommended for development):
   ```json
   {
     "command": "sh",
     "args": ["-c", "MY_API_KEY=secret node /path/to/server.js"]
   }
   ```

2. **Wrapper Script Approach** (Recommended for production):
   ```bash
   #!/bin/bash
   # wrapper.sh
   export MY_API_KEY=$(cat ~/.config/my-server/api-key)
   exec node /path/to/server.js
   ```

3. **File-Based Configuration**:
   ```typescript
   // Load secrets from files instead of environment
   const config = {
     apiKey: await fs.readFile('~/.config/my-server/api-key', 'utf-8'),
     clientSecret: await fs.readFile('~/.config/my-server/client-secret', 'utf-8'),
   };
   ```

### Security Warnings

1. **File System Access**
   - Claude Desktop runs with user permissions
   - Carefully validate all file paths
   - Implement access control lists

2. **Command Execution**
   - Commands run with full user privileges
   - Validate and sanitize all inputs
   - Use absolute paths for executables

## OAuth Implementation

### Complete OAuth Example

Here's a production-ready OAuth implementation for MCP:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import axios from 'axios';
import crypto from 'crypto';

class OAuthManager {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tokenManager: TokenManager;
  
  constructor(config: OAuthConfig) {
    this.validateConfig(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.tokenManager = new TokenManager(config.tokenStoragePath);
  }
  
  private validateConfig(config: OAuthConfig): void {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('OAuth credentials are required');
    }
    
    // Validate redirect URI
    const url = new URL(config.redirectUri);
    if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
      throw new Error('Redirect URI must use HTTPS or be localhost');
    }
  }
  
  async getAuthorizationUrl(state?: string): Promise<string> {
    const secureState = state || crypto.randomBytes(32).toString('base64url');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: secureState,
      // Add PKCE challenge if supported
      code_challenge: this.generateCodeChallenge(),
      code_challenge_method: 'S256',
    });
    
    return `${this.authEndpoint}?${params.toString()}`;
  }
  
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    try {
      const response = await axios.post(
        this.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: this.redirectUri,
          // Include PKCE verifier if used
          code_verifier: this.codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: null, // Handle all status codes
        }
      );
      
      if (response.status !== 200) {
        throw new Error(`Token exchange failed: ${response.data.error_description}`);
      }
      
      // Validate token response
      this.validateTokenResponse(response.data);
      
      // Store tokens securely
      await this.tokenManager.saveToken(response.data);
      
      return response.data;
    } catch (error) {
      // Log error securely (don't log sensitive data)
      console.error('Token exchange failed:', error.message);
      throw error;
    }
  }
  
  private validateTokenResponse(response: any): void {
    if (!response.access_token || !response.token_type) {
      throw new Error('Invalid token response');
    }
    
    // Validate token type
    if (response.token_type.toLowerCase() !== 'bearer') {
      throw new Error('Unsupported token type');
    }
    
    // Check for required scopes
    if (response.scope) {
      const grantedScopes = response.scope.split(' ');
      const requiredScopes = this.requiredScopes;
      
      for (const scope of requiredScopes) {
        if (!grantedScopes.includes(scope)) {
          throw new Error(`Required scope not granted: ${scope}`);
        }
      }
    }
  }
}
```

### API Client with Automatic Token Refresh

```typescript
class AuthenticatedAPIClient {
  private tokenManager: TokenManager;
  private oauthManager: OAuthManager;
  
  async makeAuthenticatedRequest(
    url: string,
    options: RequestOptions = {}
  ): Promise<any> {
    let token = await this.tokenManager.getToken();
    
    // Refresh token if needed
    if (this.tokenManager.isTokenExpired(token)) {
      token = await this.refreshToken(token);
    }
    
    try {
      const response = await axios({
        ...options,
        url,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token.access_token}`,
        },
      });
      
      return response.data;
    } catch (error) {
      // Handle 401 errors with token refresh
      if (error.response?.status === 401) {
        token = await this.refreshToken(token);
        
        // Retry request with new token
        return axios({
          ...options,
          url,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token.access_token}`,
          },
        });
      }
      
      throw error;
    }
  }
  
  private async refreshToken(token: TokenData): Promise<TokenData> {
    try {
      const response = await axios.post(
        this.oauthManager.tokenEndpoint,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          client_id: this.oauthManager.clientId,
          client_secret: this.oauthManager.clientSecret,
        })
      );
      
      const newToken = {
        ...response.data,
        expires_at: Math.floor(Date.now() / 1000) + response.data.expires_in,
      };
      
      await this.tokenManager.saveToken(newToken);
      return newToken;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant') {
        // Refresh token is invalid, need to re-authenticate
        throw new Error('Authentication required. Please re-authenticate.');
      }
      throw error;
    }
  }
}
```

## Development and Testing

### Mock Authentication for Tests

```typescript
// test/mocks/authMock.ts
export class MockTokenManager extends TokenManager {
  private mockTokens: Map<string, TokenData> = new Map();
  
  constructor() {
    super(); // No storage path for mocks
  }
  
  async saveToken(tenantId: string, token: TokenData): Promise<void> {
    this.mockTokens.set(tenantId, token);
  }
  
  async getToken(tenantId: string): Promise<TokenData | undefined> {
    return this.mockTokens.get(tenantId);
  }
  
  // Helper for tests
  setMockToken(tenantId: string, token: Partial<TokenData>): void {
    this.mockTokens.set(tenantId, {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'bearer',
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      ...token,
    } as TokenData);
  }
}
```

### CI/CD Security Practices

1. **Static Application Security Testing (SAST)**
   ```yaml
   # .github/workflows/security.yml
   - name: Run security scan
     uses: github/super-linter@v4
     env:
       VALIDATE_JAVASCRIPT_ES: true
       VALIDATE_TYPESCRIPT_ES: true
   ```

2. **Dependency Scanning**
   ```bash
   # Regular dependency audits
   npm audit
   npm audit fix
   
   # Check for known vulnerabilities
   npx snyk test
   ```

3. **Secret Scanning**
   - Use tools like GitGuardian or GitHub secret scanning
   - Never commit credentials, even in encrypted form
   - Use environment-specific configurations

### Testing Authentication Flows

```typescript
describe('OAuth Authentication', () => {
  let authManager: OAuthManager;
  let mockAxios: MockAdapter;
  
  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    authManager = new OAuthManager({
      clientId: 'test_client',
      clientSecret: 'test_secret',
      redirectUri: 'http://localhost:3000/callback',
      tokenStoragePath: ':memory:', // Use in-memory storage for tests
    });
  });
  
  it('should exchange code for token', async () => {
    const mockToken = {
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      expires_in: 3600,
      token_type: 'bearer',
    };
    
    mockAxios
      .onPost('/oauth/token')
      .reply(200, mockToken);
    
    const token = await authManager.exchangeCodeForToken('test_code');
    
    expect(token.access_token).toBe('test_access_token');
    expect(mockAxios.history.post[0].data).toContain('grant_type=authorization_code');
  });
  
  it('should handle invalid grant errors', async () => {
    mockAxios
      .onPost('/oauth/token')
      .reply(400, {
        error: 'invalid_grant',
        error_description: 'The provided authorization grant is invalid',
      });
    
    await expect(
      authManager.exchangeCodeForToken('invalid_code')
    ).rejects.toThrow('The provided authorization grant is invalid');
  });
});
```

## Common Pitfalls and Solutions

### 1. Token Storage Security

**Pitfall**: Storing tokens in plaintext files with world-readable permissions.

**Solution**:
```typescript
// Set restrictive file permissions
await fs.writeFile(tokenPath, tokenData, { mode: 0o600 });

// Use OS-specific secure storage when available
if (process.platform === 'darwin') {
  // Use macOS Keychain
  await keychain.setPassword({
    account: 'mcp-server',
    service: 'com.example.mcp',
    password: token,
  });
}
```

### 2. Refresh Token Reuse

**Pitfall**: Some OAuth providers (like freee) use single-use refresh tokens.

**Solution**:
```typescript
class SingleUseRefreshTokenManager extends TokenManager {
  async refreshToken(oldToken: TokenData): Promise<TokenData> {
    try {
      const newToken = await super.refreshToken(oldToken);
      
      // Immediately invalidate old token
      await this.invalidateToken(oldToken);
      
      return newToken;
    } catch (error) {
      // If refresh fails, the old token is likely already invalid
      await this.removeToken(oldToken.tenantId);
      throw new Error('Re-authentication required');
    }
  }
}
```

### 3. Race Conditions in Token Refresh

**Pitfall**: Multiple concurrent requests triggering multiple token refreshes.

**Solution**:
```typescript
class ConcurrentSafeTokenManager extends TokenManager {
  private refreshPromises: Map<string, Promise<TokenData>> = new Map();
  
  async refreshToken(tenantId: string, token: TokenData): Promise<TokenData> {
    // Check if refresh is already in progress
    const existingRefresh = this.refreshPromises.get(tenantId);
    if (existingRefresh) {
      return existingRefresh;
    }
    
    // Start new refresh
    const refreshPromise = this.doRefresh(tenantId, token);
    this.refreshPromises.set(tenantId, refreshPromise);
    
    try {
      const newToken = await refreshPromise;
      return newToken;
    } finally {
      this.refreshPromises.delete(tenantId);
    }
  }
}
```

### 4. Environment Variable Security

**Pitfall**: Storing secrets in environment variables visible to all processes.

**Solution**:
```typescript
// Load secrets from files with proper permissions
class SecureConfigLoader {
  async loadConfig(): Promise<Config> {
    const configDir = path.join(os.homedir(), '.config', 'mcp-server');
    
    return {
      clientId: await this.readSecureFile(path.join(configDir, 'client-id')),
      clientSecret: await this.readSecureFile(path.join(configDir, 'client-secret')),
    };
  }
  
  private async readSecureFile(filePath: string): Promise<string> {
    // Check file permissions
    const stats = await fs.stat(filePath);
    if ((stats.mode & 0o077) !== 0) {
      throw new Error(`File ${filePath} has insecure permissions`);
    }
    
    return fs.readFile(filePath, 'utf-8');
  }
}
```

### 5. Token Validation Bypass

**Pitfall**: Not properly validating token audience and issuer.

**Solution**:
```typescript
interface TokenClaims {
  aud: string | string[];
  iss: string;
  exp: number;
  // ... other claims
}

function validateToken(token: string, expectedAudience: string): TokenClaims {
  const decoded = jwt.decode(token) as TokenClaims;
  
  // Validate audience
  const audiences = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
  if (!audiences.includes(expectedAudience)) {
    throw new Error('Token audience mismatch');
  }
  
  // Validate issuer
  if (decoded.iss !== EXPECTED_ISSUER) {
    throw new Error('Token issuer mismatch');
  }
  
  // Validate expiration
  if (decoded.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }
  
  return decoded;
}
```

## Summary

Implementing secure authentication in MCP servers requires careful attention to:

1. **OAuth 2.1 compliance** with PKCE and secure token handling
2. **Secure token storage** with proper file permissions and encryption
3. **Claude Desktop limitations** and appropriate workarounds
4. **Comprehensive testing** including security scenarios
5. **Error handling** that doesn't leak sensitive information

By following these guidelines, you can build secure and reliable MCP servers that protect user data while providing seamless integration with AI assistants.

## Additional Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Claude Desktop Documentation](https://modelcontextprotocol.io/quickstart/user)