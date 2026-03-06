#!/usr/bin/env bash
# verify-freee-endpoint helper script
# Fetches freee OpenAPI schema and searches for endpoints
set -euo pipefail

COMMAND="${1:-}"
QUERY="${2:-}"

REPO="freee/freee-mcp"
SCHEMA_PATH="openapi/minimal/accounting.json"

fetch_schema() {
  gh api "repos/${REPO}/contents/${SCHEMA_PATH}" --jq '.content' | base64 -d
}

cmd_check_deps() {
  local missing=()
  command -v gh >/dev/null 2>&1 || missing+=("gh")
  command -v jq >/dev/null 2>&1 || missing+=("jq")
  if [ ${#missing[@]} -gt 0 ]; then
    echo "MISSING:${missing[*]}"
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "MISSING:gh-auth"
    exit 1
  fi
  echo "OK"
}

cmd_list_paths() {
  fetch_schema | jq -r '.paths | keys[]'
}

cmd_exact_match() {
  local path="$1"
  # Normalize: ensure path starts with /
  if [[ ! "$path" =~ ^/ ]]; then
    path="/$path"
  fi
  # Ensure /api/1/ prefix if not present
  if [[ ! "$path" =~ ^/api/ ]]; then
    path="/api/1/${path#/}"
  fi

  local schema
  schema=$(fetch_schema)

  local result
  result=$(echo "$schema" | jq --arg p "$path" '
    .paths[$p] // empty
  ')

  if [ -z "$result" ]; then
    echo "NOT_FOUND"
    return 1
  fi

  echo "$schema" | jq --arg p "$path" '
    .paths[$p] | to_entries | map({
      method: .key | ascii_upcase,
      summary: .value.summary,
      description: .value.description,
      parameters: (.value.parameters // []) | map({
        name: .name,
        in: .in,
        type: .type,
        required: (.required // false),
        description: .description
      })
    })
  '
}

cmd_search() {
  local keyword="$1"
  local schema
  schema=$(fetch_schema)

  echo "$schema" | jq --arg q "$keyword" '
    .paths | to_entries
    | map(select(.key | test($q; "i")))
    | map({
      path: .key,
      methods: (.value | keys | map(ascii_upcase) | join(", "))
    })
  '
}

case "$COMMAND" in
  check-deps)
    cmd_check_deps
    ;;
  list-paths)
    cmd_list_paths
    ;;
  exact)
    [ -z "$QUERY" ] && { echo "Usage: verify.sh exact <path>"; exit 1; }
    cmd_exact_match "$QUERY"
    ;;
  search)
    [ -z "$QUERY" ] && { echo "Usage: verify.sh search <keyword>"; exit 1; }
    cmd_search "$QUERY"
    ;;
  *)
    echo "Usage: verify.sh <check-deps|list-paths|exact|search> [query]"
    exit 1
    ;;
esac
