#!/usr/bin/env bash
#
# aiven-verify.sh — Post-migration verification for Aiven database
#
# Usage:
#   ./scripts/aiven-verify.sh --aiven-url <URL> [--smoke-url <BASE_URL>]
#
# Checks:
#   1. Table count (76 expected after all migrations)
#   2. _prisma_migrations (baseline + 9 additive, all finished)
#   3. pg_trgm extension present
#   4. 6 trigram indexes present
#   5. Smoke test (optional, if --smoke-url provided)
#
# Exit: 0 all pass, 1 any fail
#
set -u

# ---- colored output ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { printf "${GREEN}[PASS]${NC} %s\n" "$1"; }
fail() { printf "${RED}[FAIL]${NC} %s\n" "$1"; }
info() { printf "${CYAN}[INFO]${NC} %s\n" "$1"; }

# ---- arg parsing ----
AIVEN_URL=""
SMOKE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --aiven-url)  AIVEN_URL="$2"; shift 2 ;;
    --smoke-url)  SMOKE_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$AIVEN_URL" ]; then
  echo "Usage: $0 --aiven-url <URL> [--smoke-url <BASE_URL>]" >&2
  exit 2
fi

mask() { printf '(masked)'; }

echo "=== Aiven Migration Verification ==="
echo "aiven: $(mask)"
echo ""

FAIL_COUNT=0

# ---- Check 1: Table count ----
info "Check 1: Table count..."
TABLE_COUNT=$(psql "$AIVEN_URL" -t -A -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations';
" 2>/dev/null || echo "ERROR")

if [ "$TABLE_COUNT" = "76" ]; then
  pass "table count: 76"
elif [ "$TABLE_COUNT" = "ERROR" ]; then
  fail "table count: query failed (connection issue?)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  fail "table count: expected 76, got $TABLE_COUNT"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ---- Check 2: _prisma_migrations ----
info "Check 2: Prisma migrations..."
MIGRATION_COUNT=$(psql "$AIVEN_URL" -t -A -c "
  SELECT count(*) FROM \"_prisma_migrations\"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
" 2>/dev/null || echo "ERROR")

if [ "$MIGRATION_COUNT" = "10" ]; then
  pass "prisma migrations: 10 (baseline + 9 additive)"
elif [ "$MIGRATION_COUNT" = "ERROR" ]; then
  fail "prisma migrations: query failed"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  fail "prisma migrations: expected 10, got $MIGRATION_COUNT"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check no rolled-back migrations
ROLLED_BACK=$(psql "$AIVEN_URL" -t -A -c "
  SELECT count(*) FROM \"_prisma_migrations\"
  WHERE rolled_back_at IS NOT NULL;
" 2>/dev/null || echo "0")

if [ "$ROLLED_BACK" != "0" ]; then
  fail "prisma migrations: $ROLLED_BACK rolled-back migrations found"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  pass "prisma migrations: no rolled-back entries"
fi

# ---- Check 3: pg_trgm extension ----
info "Check 3: pg_trgm extension..."
TRGM_EXT=$(psql "$AIVEN_URL" -t -A -c "
  SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
" 2>/dev/null || echo "NONE")

if echo "$TRGM_EXT" | grep -q "pg_trgm"; then
  pass "pg_trgm extension: present"
else
  fail "pg_trgm extension: NOT found"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ---- Check 4: 6 trigram indexes ----
info "Check 4: Trigram indexes..."
TRGM_INDEXES=$(psql "$AIVEN_URL" -t -A -c "
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_%_trgm'
  ORDER BY indexname;
" 2>/dev/null || echo "ERROR")

TRGM_COUNT=$(echo "$TRGM_INDEXES" | grep -c 'idx_.*_trgm' || echo "0")

if [ "$TRGM_COUNT" = "6" ]; then
  pass "trgm indexes: 6 found"
  echo "$TRGM_INDEXES" | while read -r idx; do
    [ -n "$idx" ] && info "  - $idx"
  done
else
  fail "trgm indexes: expected 6, got $TRGM_COUNT"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  if [ "$TRGM_INDEXES" != "ERROR" ]; then
    echo "$TRGM_INDEXES" | while read -r idx; do
      [ -n "$idx" ] && info "  found: $idx"
    done
  fi
fi

# ---- Check 5: Smoke test (optional) ----
if [ -n "$SMOKE_URL" ]; then
  info "Check 5: Smoke test ($SMOKE_URL)..."
  HEALTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SMOKE_URL/api" 2>/dev/null || echo "000")
  if [ "$HEALTH_CODE" = "200" ]; then
    pass "smoke test: /api returned 200"
  else
    fail "smoke test: /api returned $HEALTH_CODE (expected 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  SEARCH_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SMOKE_URL/api/search?q=test" 2>/dev/null || echo "000")
  if [ "$SEARCH_CODE" = "200" ]; then
    pass "smoke test: /api/search returned 200"
  else
    fail "smoke test: /api/search returned $SEARCH_CODE (expected 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  info "Check 5: Smoke test skipped (no --smoke-url provided)"
fi

# ---- Summary ----
echo ""
echo "=== Verification Summary ==="
echo "Table count:     $TABLE_COUNT"
echo "Migrations:      $MIGRATION_COUNT"
echo "pg_trgm:         $TRGM_EXT"
echo "Trgm indexes:    $TRGM_COUNT"
if [ -n "$SMOKE_URL" ]; then
  echo "Health endpoint: $HEALTH_CODE"
  echo "Search endpoint: $SEARCH_CODE"
fi
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  pass "All checks passed — Aiven migration verified"
  exit 0
else
  fail "$FAIL_COUNT check(s) failed"
  echo ""
  echo "ROLLBACK:"
  echo "  1. Neon Console → Branches → pre-release-YYYYMMDD → Promote"
  echo "  2. Revert DATABASE_URL to Neon connection string"
  echo "  3. Restart app"
  exit 1
fi
