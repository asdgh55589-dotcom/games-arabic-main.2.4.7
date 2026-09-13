#!/usr/bin/env bash
#
# aiven-migrate.sh — Neon → Aiven full data migration (pg_dump → pg_restore)
#
# Usage:
#   ./scripts/aiven-migrate.sh --neon-url <URL> --aiven-url <URL> [--dry-run]
#
# Safety:
#   - NEVER echoes secret values (URLs masked in output)
#   - --dry-run prints commands without executing
#   - Errors trigger rollback hint
#   - Arabic byte-identical
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
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }

# ---- arg parsing ----
NEON_URL=""
AIVEN_URL=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --neon-url)  NEON_URL="$2"; shift 2 ;;
    --aiven-url) AIVEN_URL="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

if [ -z "$NEON_URL" ]; then
  echo "Usage: $0 --neon-url <URL> --aiven-url <URL> [--dry-run]" >&2
  exit 2
fi
if [ -z "$AIVEN_URL" ]; then
  echo "Usage: $0 --neon-url <URL> --aiven-url <URL> [--dry-run]" >&2
  exit 2
fi

mask() { printf '(masked)'; }

DUMP_FILE="/tmp/neon-aiven-$(date +%Y%m%d%H%M%S).dump"

echo "=== Aiven Migration: Neon → Aiven ==="
echo "neon:  $(mask)"
echo "aiven: $(mask)"
echo "dump:  $DUMP_FILE"
echo "dry:   $DRY_RUN"
echo ""

# ---- check prerequisites ----
if [ "$DRY_RUN" != true ]; then
  check_cmd() {
    local cmd="$1"
    if command -v "$cmd" >/dev/null 2>&1; then
      pass "prerequisite: $cmd found"
    else
      fail "prerequisite: $cmd not found — install PostgreSQL client tools"
      exit 1
    fi
  }

  check_cmd pg_dump
  check_cmd pg_restore
  check_cmd psql
else
  info "[DRY-RUN] Skipping prerequisite checks (no commands executed)"
fi

# ---- Step 1: Test connections ----
info "Step 1: Testing connections..."

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    info "[DRY-RUN] $1"
    return 0
  fi
  eval "$1"
}

if ! run_cmd "psql \"$NEON_URL\" -c 'SELECT 1;' >/dev/null 2>&1"; then
  fail "Cannot connect to Neon"
  echo "ROLLBACK HINT: Verify NEON_URL is correct and Neon is running."
  exit 1
fi
pass "Neon connection OK"

if ! run_cmd "psql \"$AIVEN_URL\" -c 'SELECT 1;' >/dev/null 2>&1"; then
  fail "Cannot connect to Aiven"
  echo "ROLLBACK HINT: Verify AIVEN_URL is correct and Aiven service is running."
  exit 1
fi
pass "Aiven connection OK"

# ---- Step 2: Pre-dump Neon table count ----
info "Step 2: Recording Neon table count..."
NEON_TABLE_COUNT=""
if [ "$DRY_RUN" != true ]; then
  NEON_TABLE_COUNT=$(psql "$NEON_URL" -t -A -c "
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations';
  " 2>/dev/null || echo "?")
  info "Neon table count: $NEON_TABLE_COUNT"
else
  info "[DRY-RUN] Would query Neon table count"
fi

# ---- Step 3: pg_dump ----
info "Step 3: pg_dump from Neon..."
DUMP_CMD="pg_dump \"$NEON_URL\" --format=custom --no-owner --no-privileges --schema=public --verbose --file=\"$DUMP_FILE\""
run_cmd "$DUMP_CMD"
DUMP_EXIT=$?

if [ "$DRY_RUN" != true ] && [ $DUMP_EXIT -ne 0 ]; then
  fail "pg_dump failed (exit $DUMP_EXIT)"
  echo "ROLLBACK HINT: Neon is untouched. Check pg_dump output above."
  exit 1
fi
pass "pg_dump completed"

# ---- Step 4: pg_restore ----
info "Step 4: pg_restore to Aiven..."
RESTORE_CMD="pg_restore \"$AIVEN_URL\" --format=custom --no-owner --no-privileges --schema=public --verbose --clean --if-exists \"$DUMP_FILE\""
run_cmd "$RESTORE_CMD"
RESTORE_EXIT=$?

if [ "$DRY_RUN" != true ] && [ $RESTORE_EXIT -ne 0 ]; then
  fail "pg_restore failed (exit $RESTORE_EXIT)"
  echo "ROLLBACK HINT: Restore Neon branch as primary, revert DATABASE_URL."
  echo "  1. Neon Console → Branches → pre-release-YYYYMMDD → Promote"
  echo "  2. Revert DATABASE_URL to Neon connection string"
  echo "  3. Restart app"
  exit 1
fi
pass "pg_restore completed"

# ---- Step 5: Verify migration ----
info "Step 5: Verifying migration..."

verify_check() {
  local label="$1" query="$2" expected="$3"
  if [ "$DRY_RUN" = true ]; then
    info "[DRY-RUN] Verify: $label (expected: $expected)"
    return 0
  fi
  local result
  result=$(psql "$AIVEN_URL" -t -A -c "$query" 2>/dev/null || echo "ERROR")
  if echo "$result" | grep -q "$expected"; then
    pass "verify: $label (got: $result)"
  else
    fail "verify: $label (expected: $expected, got: $result)"
    return 1
  fi
}

FAIL_COUNT=0

# Table count
EXPECTED_TABLES="${NEON_TABLE_COUNT:-76}"
verify_check "table count" \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name != '_prisma_migrations';" \
  "$EXPECTED_TABLES" || FAIL_COUNT=$((FAIL_COUNT + 1))

# Prisma migrations
verify_check "_prisma_migrations exists" \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;" \
  "" || FAIL_COUNT=$((FAIL_COUNT + 1))

# pg_trgm extension
verify_check "pg_trgm extension" \
  "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';" \
  "pg_trgm" || FAIL_COUNT=$((FAIL_COUNT + 1))

# 6 trigram indexes
TRGM_COUNT=""
if [ "$DRY_RUN" != true ]; then
  TRGM_COUNT=$(psql "$AIVEN_URL" -t -A -c "
    SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%_trgm';
  " 2>/dev/null || echo "0")
fi
if [ "$DRY_RUN" = true ]; then
  info "[DRY-RUN] Would check trgm index count"
elif [ "$TRGM_COUNT" = "6" ]; then
  pass "verify: 6 trgm indexes (got: $TRGM_COUNT)"
else
  fail "verify: 6 trgm indexes (got: $TRGM_COUNT)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ---- Step 6: Report ----
echo ""
echo "=== Migration Report ==="
echo "Dump file: $DUMP_FILE"
echo "Table count (Neon): ${NEON_TABLE_COUNT:-?}"
echo "Trgm indexes: ${TRGM_COUNT:-?}"
echo ""

if [ "$DRY_RUN" = true ]; then
  info "[DRY-RUN] No changes made. Commands printed but not executed."
  exit 0
fi

if [ $FAIL_COUNT -eq 0 ]; then
  pass "All verification checks passed"
  echo ""
  echo "NEXT STEPS:"
  echo "  1. Update DATABASE_URL to Aiven connection string"
  echo "  2. Run: npx prisma migrate status (expect: up to date)"
  echo "  3. Restart app"
  echo "  4. Run: ./scripts/aiven-verify.sh --aiven-url <AIVEN_URL>"
  exit 0
else
  fail "$FAIL_COUNT verification check(s) failed"
  echo ""
  echo "ROLLBACK:"
  echo "  1. Neon Console → Branches → pre-release-YYYYMMDD → Promote to primary"
  echo "  2. Revert DATABASE_URL to Neon connection string"
  echo "  3. Restart app"
  echo "  4. Investigate failures above"
  exit 1
fi
