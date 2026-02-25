---
name: freee-setup
description: "Interactive setup wizard for freee-mcp in Claude Desktop"
user-invocable: true
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
argument-hint: "[--mode npx|local]"
---

# freee-mcp Setup Skill

Interactive setup wizard that configures freee-mcp as an MCP server in Claude Desktop.

## Overview

This skill automates the 4-step manual setup process:

1. Register a freee OAuth application (guided)
2. Generate a secure `FREEE_TOKEN_ENCRYPTION_KEY`
3. Edit `claude_desktop_config.json` with the correct structure
4. Remind user to restart Claude Desktop

## Skill Directory

The helper script is located relative to this skill file:

```
SCRIPT_DIR: skills/freee-setup/setup.sh
```

When invoked from `~/.claude/skills/freee-setup/`, use:

```bash
SCRIPT="$HOME/.claude/skills/freee-setup/setup.sh"
```

When invoked from the freee-mcp repo, use:

```bash
SCRIPT="$(git rev-parse --show-toplevel)/skills/freee-setup/setup.sh"
```

Detect which path exists and set `SCRIPT` accordingly.

## Workflow

### Step 1: Detect Environment

```bash
bash "$SCRIPT" detect-config
```

Save the output as `CONFIG_PATH`.

If `UNSUPPORTED` is returned, inform the user that their OS is not supported and show the manual setup instructions from the README.

### Step 2: Check jq Availability

```bash
bash "$SCRIPT" check-jq
```

If exit code is non-zero (jq not found):

Use `AskUserQuestion`:

- Header: "jq Required"
- Question: "This skill requires `jq` for safe JSON manipulation. How would you like to proceed?"
- Options:
  - "Install jq with Homebrew (macOS)" → Run `brew install jq`, then continue
  - "Show manual setup instructions" → Display the manual config template below and EXIT
  - "Cancel"

**Manual config template** (display if jq unavailable and user chooses manual):

```json
{
  "mcpServers": {
    "freee": {
      "command": "npx",
      "args": ["-y", "github:knishioka/freee-mcp"],
      "env": {
        "FREEE_CLIENT_ID": "<your_client_id>",
        "FREEE_CLIENT_SECRET": "<your_client_secret>",
        "FREEE_TOKEN_ENCRYPTION_KEY": "<run: openssl rand -hex 32>"
      }
    }
  }
}
```

Tell the user the config file location is: `CONFIG_PATH`

### Step 3: Check Existing Configuration

```bash
bash "$SCRIPT" check-existing --config "$CONFIG_PATH"
```

If output starts with `EXISTS`:

Use `AskUserQuestion`:

- Header: "Existing Configuration"
- Question: "freee-mcp is already configured in Claude Desktop. The current configuration will be shown. Would you like to update it?"
- Options:
  - "Update existing configuration"
  - "Cancel"

If user cancels, EXIT.

### Step 4: Guide OAuth App Registration

Display the following instructions to the user:

---

**freee OAuth アプリケーションの登録**

freee-mcp を使うには、freee の OAuth アプリケーションを作成する必要があります。

1. [freee Developers](https://app.secure.freee.co.jp/developers/apps) にアクセス
2. 「新しいアプリケーションを作成」をクリック
3. 以下の設定で作成:
   - **アプリ名**: 任意（例: `freee-mcp`）
   - **コールバック URL**: `urn:ietf:wg:oauth:2.0:oob`
4. 作成後、**Client ID** と **Client Secret** をコピー

---

Then use `AskUserQuestion`:

- Header: "Client ID"
- Question: "freee OAuth アプリの Client ID を入力してください:"

Save the response as `CLIENT_ID`. Validate it is non-empty.

Then use `AskUserQuestion`:

- Header: "Client Secret"
- Question: "freee OAuth アプリの Client Secret を入力してください:"

Save the response as `CLIENT_SECRET`. Validate it is non-empty.

### Step 5: Generate Encryption Key

```bash
bash "$SCRIPT" generate-key
```

Save the output as `ENCRYPTION_KEY`.

### Step 6: Choose Installation Mode

Parse the `--mode` argument if provided. If not provided:

Use `AskUserQuestion`:

- Header: "Installation Mode"
- Question: "freee-mcp のインストール方法を選択してください:"
- Options:
  - "npx (推奨 - ビルド不要、自動更新)" → Set `MODE=npx`
  - "Local build (開発者向け - ローカルビルドを使用)" → Set `MODE=local`

If `MODE=local`:

Use `AskUserQuestion`:

- Header: "Local Path"
- Question: "freee-mcp の `dist/index.js` への絶対パスを入力してください (例: /Users/you/freee-mcp/dist/index.js):"

Save the response as `LOCAL_PATH`. Validate the path ends with `dist/index.js`.

### Step 7: Update Configuration

Build the command based on mode:

**npx mode:**

```bash
bash "$SCRIPT" update-config \
  --config "$CONFIG_PATH" \
  --client-id "$CLIENT_ID" \
  --client-secret "$CLIENT_SECRET" \
  --encryption-key "$ENCRYPTION_KEY" \
  --mode npx
```

**local mode:**

```bash
bash "$SCRIPT" update-config \
  --config "$CONFIG_PATH" \
  --client-id "$CLIENT_ID" \
  --client-secret "$CLIENT_SECRET" \
  --encryption-key "$ENCRYPTION_KEY" \
  --mode local \
  --local-path "$LOCAL_PATH"
```

If the command fails, display the error and EXIT.

### Step 8: Validate Configuration

```bash
bash "$SCRIPT" validate --config "$CONFIG_PATH"
```

If `INVALID`, display error and instruct user to check the config file manually.

### Step 9: Display Results

Read the config file and display the freee section:

```bash
jq '.mcpServers.freee' "$CONFIG_PATH"
```

Then display the completion message:

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ freee-mcp セットアップ完了
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

設定ファイル: $CONFIG_PATH

次のステップ:
1. Claude Desktop を再起動してください
2. 再起動後、freee の認証を行います:
   - Claude Desktop で「freee_get_auth_url」ツールを使用
   - 表示される URL をブラウザで開いて認証
   - 認証コードを「freee_get_access_token」ツールに入力

💡 ヒント:
- FREEE_DEFAULT_COMPANY_ID を設定すると、毎回 companyId を指定する必要がなくなります
- 認証情報は暗号化されて安全に保存されます
```

---

**IMPORTANT**: Do NOT display the `ENCRYPTION_KEY` or `CLIENT_SECRET` values in the completion message. Only show the config structure.

## Platform Notes

| OS      | Config Path                                                       | Notes                                   |
| ------- | ----------------------------------------------------------------- | --------------------------------------- |
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` | Primary support                         |
| Linux   | `~/.config/Claude/claude_desktop_config.json`                     | Supported                               |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json`                     | Requires WSL or Git Bash for this skill |
