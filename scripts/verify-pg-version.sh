#!/usr/bin/env bash
# verify-pg-version.sh — require PostgreSQL 17+ client tools for backups/migrations.
set -euo pipefail

MIN_MAJOR=17
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
PSQL_BIN="${PSQL_BIN:-psql}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failures=0

pass() { printf '%b✓ %s%b\n' "$GREEN" "$*" "$NC"; }
fail() { printf '%b✗ %s%b\n' "$RED" "$*" "$NC" >&2; }
warn() { printf '%b⚠ %s%b\n' "$YELLOW" "$*" "$NC"; }

extract_major() {
  awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^[0-9]+(\.[0-9]+)*$/) {
        split($i, parts, ".")
        print parts[1]
        exit
      }
    }
  }'
}

check_tool() {
  local label="$1"
  local bin="$2"
  local version major

  if ! command -v "$bin" >/dev/null 2>&1; then
    fail "$label not found: $bin"
    failures=$((failures + 1))
    return
  fi

  if ! version="$("$bin" --version 2>&1)"; then
    fail "$label failed to report its version: $bin"
    failures=$((failures + 1))
    return
  fi

  major="$(printf '%s\n' "$version" | extract_major)"
  if [[ ! "$major" =~ ^[0-9]+$ ]]; then
    fail "$label version could not be parsed: $version"
    failures=$((failures + 1))
    return
  fi

  if ((major < MIN_MAJOR)); then
    fail "$label is PostgreSQL $major (need >= $MIN_MAJOR): $version"
    failures=$((failures + 1))
    return
  fi

  pass "$label $major ($bin)"
}

check_tool "pg_dump" "$PG_DUMP_BIN"
check_tool "pg_restore" "$PG_RESTORE_BIN"
check_tool "psql" "$PSQL_BIN"

if ((failures > 0)); then
  warn "PostgreSQL 17+ client tools are required (pg_dump/pg_restore/psql)."
  cat >&2 <<'EOF'

Remediation:
  - Install the PostgreSQL 17 client tools, then re-run `bun run verify:pg`.
  - Alpine:        apk add --no-cache postgresql17-client
  - Debian/Ubuntu: apt-get install postgresql-client-17
  - macOS:         brew install postgresql@17 && brew link --force postgresql@17
  - No local install? Run inside the official image, e.g.:
      docker run --rm -v "$PWD":/work -w /work postgres:17 pg_dump --version
    or use the project image once built (it includes postgresql17-client).
  - Custom paths/binaries:
      PG_DUMP_BIN=/path/to/pg_dump \
      PG_RESTORE_BIN=/path/to/pg_restore \
      PSQL_BIN=/path/to/psql bun run verify:pg
EOF
  exit 1
fi

pass "PostgreSQL client tools are ready (major >= $MIN_MAJOR)"
