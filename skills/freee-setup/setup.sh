#!/usr/bin/env bash
set -euo pipefail

# freee-mcp Claude Desktop configuration helper
# Usage: setup.sh <action> [options]
#
# Actions:
#   detect-config      Print claude_desktop_config.json path for current OS
#   check-jq           Exit 0 if jq is installed, 1 otherwise
#   check-existing     Check if freee entry exists in config
#   generate-key       Generate a secure encryption key
#   update-config      Add/update freee entry in config
#   validate           Validate config JSON

ACTION="${1:-}"
shift || true

# --- Helpers ---

detect_config_path() {
  case "$(uname -s)" in
    Darwin)
      echo "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
      ;;
    Linux)
      echo "${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "$APPDATA/Claude/claude_desktop_config.json"
      ;;
    *)
      echo "UNSUPPORTED" >&2
      return 1
      ;;
  esac
}

usage() {
  cat <<'USAGE'
Usage: setup.sh <action> [options]

Actions:
  detect-config                      Print config file path
  check-jq                          Check jq availability
  check-existing --config <path>    Check if freee entry exists
  generate-key                      Generate encryption key
  update-config [options]           Update config file
  validate --config <path>          Validate JSON

update-config options:
  --config <path>          Config file path
  --client-id <id>         freee Client ID
  --client-secret <secret> freee Client Secret
  --encryption-key <key>   Encryption key
  --mode <npx|local>       Installation mode (default: npx)
  --local-path <path>      Path to dist/index.js (required for local mode)
USAGE
}

# --- Actions ---

action_detect_config() {
  detect_config_path
}

action_check_jq() {
  if command -v jq >/dev/null 2>&1; then
    echo "jq $(jq --version 2>/dev/null || echo 'available')"
    return 0
  else
    echo "jq not found"
    return 1
  fi
}

action_check_existing() {
  local config_path=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config) config_path="$2"; shift 2 ;;
      *) echo "Unknown option: $1" >&2; return 1 ;;
    esac
  done

  if [[ -z "$config_path" ]]; then
    echo "Error: --config is required" >&2
    return 1
  fi

  if [[ ! -f "$config_path" ]]; then
    echo "NOT_FOUND"
    return 0
  fi

  if jq -e '.mcpServers.freee // empty' "$config_path" >/dev/null 2>&1; then
    echo "EXISTS"
    jq '.mcpServers.freee' "$config_path"
    return 0
  else
    echo "NOT_CONFIGURED"
    return 0
  fi
}

action_generate_key() {
  openssl rand -hex 32
}

action_update_config() {
  local config_path="" client_id="" client_secret="" encryption_key=""
  local mode="npx" local_path=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config) config_path="$2"; shift 2 ;;
      --client-id) client_id="$2"; shift 2 ;;
      --client-secret) client_secret="$2"; shift 2 ;;
      --encryption-key) encryption_key="$2"; shift 2 ;;
      --mode) mode="$2"; shift 2 ;;
      --local-path) local_path="$2"; shift 2 ;;
      *) echo "Unknown option: $1" >&2; return 1 ;;
    esac
  done

  # Validate required args
  if [[ -z "$config_path" ]]; then
    echo "Error: --config is required" >&2; return 1
  fi
  if [[ -z "$client_id" ]]; then
    echo "Error: --client-id is required" >&2; return 1
  fi
  if [[ -z "$client_secret" ]]; then
    echo "Error: --client-secret is required" >&2; return 1
  fi
  if [[ -z "$encryption_key" ]]; then
    echo "Error: --encryption-key is required" >&2; return 1
  fi
  if [[ "$mode" == "local" && -z "$local_path" ]]; then
    echo "Error: --local-path is required for local mode" >&2; return 1
  fi

  # Build MCP config JSON based on mode
  local mcp_config
  if [[ "$mode" == "local" ]]; then
    mcp_config=$(jq -n \
      --arg client_id "$client_id" \
      --arg client_secret "$client_secret" \
      --arg encryption_key "$encryption_key" \
      --arg local_path "$local_path" \
      '{
        command: "node",
        args: [$local_path],
        env: {
          FREEE_CLIENT_ID: $client_id,
          FREEE_CLIENT_SECRET: $client_secret,
          FREEE_TOKEN_ENCRYPTION_KEY: $encryption_key
        }
      }')
  else
    mcp_config=$(jq -n \
      --arg client_id "$client_id" \
      --arg client_secret "$client_secret" \
      --arg encryption_key "$encryption_key" \
      '{
        command: "npx",
        args: ["-y", "github:knishioka/freee-mcp"],
        env: {
          FREEE_CLIENT_ID: $client_id,
          FREEE_CLIENT_SECRET: $client_secret,
          FREEE_TOKEN_ENCRYPTION_KEY: $encryption_key
        }
      }')
  fi

  # Ensure config directory exists
  local config_dir
  config_dir=$(dirname "$config_path")
  mkdir -p "$config_dir"

  # Ensure config file exists with valid JSON
  if [[ ! -f "$config_path" ]]; then
    echo '{}' > "$config_path"
  fi

  # Update config: set .mcpServers.freee preserving all other entries
  # jq creates intermediate objects (.mcpServers) automatically if absent
  local tmp_file
  tmp_file=$(mktemp "$(dirname "$config_path")/.config.XXXXXX")
  trap 'rm -f "$tmp_file"' RETURN
  jq --argjson config "$mcp_config" '.mcpServers.freee = $config' "$config_path" > "$tmp_file" && mv "$tmp_file" "$config_path"

  echo "OK"
}

action_validate() {
  local config_path=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config) config_path="$2"; shift 2 ;;
      *) echo "Unknown option: $1" >&2; return 1 ;;
    esac
  done

  if [[ -z "$config_path" ]]; then
    echo "Error: --config is required" >&2
    return 1
  fi

  if [[ ! -f "$config_path" ]]; then
    echo "Error: File not found: $config_path" >&2
    return 1
  fi

  if jq empty "$config_path" 2>/dev/null; then
    echo "VALID"
    return 0
  else
    echo "INVALID"
    return 1
  fi
}

# --- Main ---

case "$ACTION" in
  detect-config)  action_detect_config ;;
  check-jq)       action_check_jq ;;
  check-existing) action_check_existing "$@" ;;
  generate-key)   action_generate_key ;;
  update-config)  action_update_config "$@" ;;
  validate)       action_validate "$@" ;;
  -h|--help|help) usage ;;
  *)
    echo "Error: Unknown action: ${ACTION:-<none>}" >&2
    usage >&2
    exit 1
    ;;
esac
