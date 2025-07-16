# MCP Authentication Guide for freee-mcp

This guide covers authentication best practices for the freee MCP server, with specific considerations for Claude Desktop integration.

## Table of Contents
- [Security Best Practices](#security-best-practices)
- [Authentication Patterns](#authentication-patterns)
- [Token Storage Options](#token-storage-options)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Security Best Practices

### Token Security
1. **Encryption at Rest**: All tokens are encrypted using AES-256-GCM before storage
2. **File Permissions**: Token files are created with 0600 permissions (owner read/write only)
3. **Secure Storage Paths**: Platform-specific secure directories are used by default
4. **Environment Variable Encryption**: Support for base64-encoded encrypted tokens

### OAuth 2.0 Implementation
- Uses Authorization Code flow with PKCE support
- Implements automatic token refresh 5 minutes before expiry
- Single-use refresh tokens are handled correctly with proper error recovery
- No long-lived sessions - each request is authenticated independently

### Rate Limiting Protection
- Implements exponential backoff for failed requests
- Respects freee's 3,600 requests/hour limit
- Uses aggregated APIs to minimize request count

## Authentication Patterns

### Initial Setup Flow
1. **Get Authorization URL**
   ```json
   {
     "tool": "freee_get_auth_url",
     "arguments": {
       "state": "optional-state-parameter"
     }
   }
   ```

2. **Exchange Code for Token**
   ```json
   {
     "tool": "freee_get_access_token",
     "arguments": {
       "code": "authorization-code-from-callback"
     }
   }
   ```

### Token Refresh Strategy
- Tokens are automatically refreshed when:
  - A request returns 401 Unauthorized
  - Token is within 5 minutes of expiry
  - Pre-request check detects expired token

- Refresh failures are handled gracefully:
  - Invalid grant errors prompt for re-authentication
  - Failed refreshes remove corrupted tokens
  - Clear error messages guide users to resolution

## Token Storage Options

### 1. File-Based Storage (Default)
```bash
# Default locations:
# macOS: ~/Library/Application Support/freee-mcp/tokens.enc
# Windows: %APPDATA%/freee-mcp/tokens.enc
# Linux: ~/.config/freee-mcp/tokens.enc

# Custom location via environment:
export TOKEN_STORAGE_PATH=/custom/path/tokens.enc
```

**Pros:**
- Persistent across sessions
- Encrypted with configurable key
- Automatic permission management

**Cons:**
- Requires file system access
- May not work in restricted environments

### 2. Environment Variable Storage
```bash
# Individual token variables (legacy)
export FREEE_ACCESS_TOKEN="your-access-token"
export FREEE_REFRESH_TOKEN="your-refresh-token"
export FREEE_COMPANY_ID="12345"
export FREEE_TOKEN_EXPIRES_AT="1234567890"

# Base64 encoded token data (recommended)
export FREEE_TOKEN_DATA_BASE64="base64-encoded-json"
```

**Pros:**
- Works in serverless environments
- No file system dependencies
- Easy to manage in CI/CD

**Cons:**
- Tokens visible in process environment
- Limited by environment size constraints

### 3. Claude Desktop Configuration
```json
{
  "mcpServers": {
    "freee": {
      "command": "npx",
      "args": ["-y", "@your-org/freee-mcp"],
      "env": {
        "FREEE_CLIENT_ID": "your-client-id",
        "FREEE_CLIENT_SECRET": "your-client-secret",
        "FREEE_DEFAULT_COMPANY_ID": "12345",
        "FREEE_TOKEN_ENCRYPTION_KEY": "your-secret-key",
        "TOKEN_STORAGE_PATH": "/Users/you/.config/freee-mcp/tokens.enc"
      }
    }
  }
}
```

## Claude Desktop Configuration

### macOS Configuration Location
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows Configuration Location
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Security Considerations
1. **File System Access**: Claude Desktop may restrict file access
   - Use absolute paths for TOKEN_STORAGE_PATH
   - Ensure Claude has read/write permissions
   - Consider using environment variables for restricted environments

2. **Environment Variables**: Passed securely to MCP process
   - Variables are isolated to the MCP server process
   - Not visible to other MCP servers or processes
   - Cleared when server stops

3. **Token Persistence**: Choose based on your security requirements
   - File storage: Persistent but requires file access
   - Environment variables: Session-only but more restricted

### Recommended Configuration
```json
{
  "mcpServers": {
    "freee": {
      "command": "npx",
      "args": ["-y", "@your-org/freee-mcp"],
      "env": {
        "FREEE_CLIENT_ID": "your-client-id",
        "FREEE_CLIENT_SECRET": "your-client-secret",
        "FREEE_DEFAULT_COMPANY_ID": "12345",
        "FREEE_TOKEN_ENCRYPTION_KEY": "generate-a-strong-key",
        "FREEE_TOKEN_DATA_BASE64": "pre-authenticated-token-data"
      }
    }
  }
}
```

## Development Workflow

### Local Development
1. Create `.env` file (don't commit!):
   ```env
   FREEE_CLIENT_ID=your-client-id
   FREEE_CLIENT_SECRET=your-client-secret
   FREEE_DEFAULT_COMPANY_ID=12345
   FREEE_TOKEN_ENCRYPTION_KEY=dev-encryption-key
   ```

2. Run authentication setup:
   ```bash
   npm run setup-auth
   ```

3. Test with MCP inspector:
   ```bash
   npm run inspector
   ```

### CI/CD Integration
1. Store tokens as encrypted secrets
2. Use FREEE_TOKEN_DATA_BASE64 for token injection
3. Implement automated token refresh in long-running processes

### Testing with Mock Authentication
```typescript
// Set up test environment
process.env.NODE_ENV = 'test';
process.env.FREEE_CLIENT_ID = 'test-client';
process.env.FREEE_CLIENT_SECRET = 'test-secret';

// Mock token data
const mockTokenData = Buffer.from(JSON.stringify([
  [12345, {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 86400,
    token_type: 'Bearer',
    scope: 'read write',
    created_at: Math.floor(Date.now() / 1000)
  }]
])).toString('base64');

process.env.FREEE_TOKEN_DATA_BASE64 = mockTokenData;
```

## Troubleshooting

### Common Issues

#### "No authenticated companies found"
**Cause**: No valid tokens available
**Solution**: 
1. Run freee_get_auth_url to start OAuth flow
2. Complete authorization in browser
3. Use freee_get_access_token with the code

#### "Token refresh failed: invalid_grant"
**Cause**: Refresh token already used or expired
**Solution**: 
- freee refresh tokens are single-use only
- Must re-authenticate when refresh fails
- Consider implementing token backup strategy

#### "Permission denied" on token file
**Cause**: Incorrect file permissions
**Solution**: 
- Server automatically fixes permissions
- Ensure parent directory is writable
- Check TOKEN_STORAGE_PATH is accessible

#### "Cannot find tokens.enc"
**Cause**: Claude Desktop file access restrictions
**Solution**:
1. Use absolute paths in configuration
2. Try environment variable storage instead
3. Check Claude Desktop has necessary permissions

### Debug Mode
Enable detailed logging:
```bash
export DEBUG=freee-mcp:*
export NODE_ENV=development
```

### Security Audit Checklist
- [ ] Tokens encrypted at rest
- [ ] File permissions set to 0600
- [ ] No tokens in logs or error messages
- [ ] Encryption key not hardcoded
- [ ] Refresh tokens properly invalidated
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive data

## Best Practices Summary

1. **Always encrypt tokens** - Use FREEE_TOKEN_ENCRYPTION_KEY
2. **Use secure storage paths** - Platform-specific secure directories
3. **Implement proper error handling** - Guide users to resolution
4. **Respect rate limits** - Use aggregated APIs when possible
5. **Plan for token refresh** - Handle single-use refresh tokens
6. **Test authentication flows** - Include error scenarios
7. **Document configuration** - Make setup clear for users

## Additional Resources

- [freee API Documentation](https://developer.freee.co.jp/docs)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [MCP Specification](https://github.com/modelcontextprotocol/specification)
- [Claude Desktop Documentation](https://docs.anthropic.com/claude/docs/claude-desktop)