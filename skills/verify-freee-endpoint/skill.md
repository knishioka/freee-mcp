---
name: verify-freee-endpoint
description: "Verify whether a freee API endpoint exists by referencing the official OpenAPI schema"
user-invocable: true
allowed-tools:
  - Bash
argument-hint: "<endpoint-or-keyword>"
---

# verify-freee-endpoint

Instantly verify whether a freee API endpoint exists by referencing the official freee OpenAPI schema hosted at `freee/freee-mcp`.

## Trigger

Activate this skill when the user:

- Asks `/verify-freee-endpoint <path-or-keyword>`
- Asks "Does freee have a budget API?"
- Asks "What are the parameters for trial_pl_sections?"
- Asks "Can I use /api/1/budgets?"
- Wants to check if a specific freee API endpoint exists before implementing

## Skill Directory

The helper script is located relative to this skill file:

```
SCRIPT_DIR: skills/verify-freee-endpoint/verify.sh
```

When invoked from `~/.claude/skills/verify-freee-endpoint/`, use:

```bash
SCRIPT="$HOME/.claude/skills/verify-freee-endpoint/verify.sh"
```

When invoked from the freee-mcp repo, use:

```bash
SCRIPT="$(git rev-parse --show-toplevel)/skills/verify-freee-endpoint/verify.sh"
```

Detect which path exists and set `SCRIPT` accordingly.

## Workflow

### Step 1: Check Dependencies

```bash
bash "$SCRIPT" check-deps
```

If output contains `MISSING`, inform the user which tools need to be installed (`gh` and/or `jq`).

### Step 2: Parse User Query

Extract the endpoint path or keyword from the user's argument.

**Classification rules:**

- If the query looks like a path (contains `/` or starts with `api`): treat as **exact match** query
- Otherwise: treat as **keyword search** query

Examples:

| User Input                 | Type   | Query                      |
| -------------------------- | ------ | -------------------------- |
| `/api/1/deals`             | exact  | `/api/1/deals`             |
| `deals`                    | search | `deals`                    |
| `budget`                   | search | `budget`                   |
| `/api/1/trial_pl_sections` | exact  | `/api/1/trial_pl_sections` |
| `trial_pl`                 | search | `trial_pl`                 |

### Step 3a: Exact Match

If classified as exact match:

```bash
bash "$SCRIPT" exact "<path>"
```

The script normalizes paths (adds `/api/1/` prefix if missing).

**If result is `NOT_FOUND`**: Fall through to Step 3b (keyword search) using the last path segment as keyword.

**If result is JSON**: Display the endpoint details in the following format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
endpoint: <path>  EXISTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each method in the result:

## <METHOD> <path>

<summary>

Parameters:
| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| ...  | ...| ...  | ...      | ...         |
```

### Step 3b: Keyword Search

```bash
bash "$SCRIPT" search "<keyword>"
```

**If result is empty array `[]`**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"<keyword>" に一致するエンドポイントはありません
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

freee Accounting API (89 endpoints) に該当するパスが見つかりませんでした。

利用可能なエンドポイント一覧を確認するには:
  /verify-freee-endpoint list
```

**If result has matches**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"<keyword>" の検索結果: N 件
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Path | Methods |
|------|---------|
| ...  | ...     |

詳細を確認するには:
  /verify-freee-endpoint <path>
```

### Step 3c: List All Paths (keyword = "list")

If the user's query is `list` or `all`:

```bash
bash "$SCRIPT" list-paths
```

Display all available endpoint paths grouped by resource.

## Data Source

- **Repository**: `freee/freee-mcp` (official freee organization)
- **File**: `openapi/minimal/accounting.json`
- **Fetch method**: `gh api repos/freee/freee-mcp/contents/openapi/minimal/accounting.json`
- **Encoding**: Base64 (decoded by the helper script)
- **Coverage**: freee Accounting API (89 endpoints as of 2026-03)

## Notes

- The OpenAPI schema is the `minimal` version containing paths, methods, parameters, and summaries
- No authentication tokens are required beyond `gh` CLI auth
- Results reflect the schema in the `freee/freee-mcp` repository (may differ from production API)
