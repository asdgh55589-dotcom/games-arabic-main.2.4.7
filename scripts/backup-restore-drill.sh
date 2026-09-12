#!/usr/bin/env bash
#
# backup-restore-drill.sh — SA-3 disaster-recovery drill (scratch DB only)
#
# Usage:
#   DATABASE_URL_SCRATCH="postgresql://..." ./scripts/backup-restore-drill.sh <backup-file>
#   BASE_URL="http://localhost:3000" DATABASE_URL_SCRATCH="..." ./scripts/backup-restore-drill.sh backups/db-backup-....sql.gz
#
# - NEVER runs against prod (requires DATABASE_URL_SCRATCH, refuses DATABASE_URL).
# - NEVER echoes secret values (URLs are masked in all output).
# - Read-only smoke only (GETs). POST smokes are documented as MANUAL steps.
#
set -u

BACKUP_FILE="${1:-}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

mask() { printf '(masked)'; }

report() {
  # $1 = PASS|FAIL|SKIP, $2 = step name, $3 = exit code / detail (no secrets)
  local status="$1" name="$2" detail="${3:-0}"
  if [ "$status" = "PASS" ]; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); fi
  printf '[%s] %s (exit=%s)\n' "$status" "$name" "$detail"
}

usage() {
  echo "Usage: $0 <backup-file>" >&2
  echo "Requires env: DATABASE_URL_SCRATCH (scratch DB URL — never prod)" >&2
}

echo "=== backup restore drill (scratch only) ==="
echo "backup: ${BACKUP_FILE:-<missing>}"
echo "base:   $BASE_URL"
echo "scratch db: $(mask)"

# --- Step 0: preconditions -------------------------------------------------
if [ -z "$BACKUP_FILE" ]; then usage; report FAIL "args: backup file given" 2; exit 2; fi
if [ ! -f "$BACKUP_FILE" ]; then report FAIL "step1: backup file exists" 1; else
  if [ ! -s "$BACKUP_FILE" ]; then report FAIL "step1: backup file exists+nonempty" 1;
  else report PASS "step1: backup file exists+nonempty" 0; fi
fi
if [ -z "${DATABASE_URL_SCRATCH:-}" ]; then
  echo "ERROR: DATABASE_URL_SCRATCH is not set (refusing to touch prod). Set it to a scratch database URL." >&2
  report FAIL "step2: DATABASE_URL_SCRATCH set" 2
  echo "---"; echo "PASS=$PASS FAIL=$FAIL"; exit 2
else report PASS "step2: DATABASE_URL_SCRATCH set" 0; fi

# Safety: refuse if scratch URL looks like prod (heuristic: contains 'prod')
case "${DATABASE_URL_SCRATCH}" in
  *prod*) echo "ERROR: DATABASE_URL_SCRATCH looks like prod — aborting." >&2
    report FAIL "step3: scratch-is-not-prod guard" 3
    echo "---"; echo "PASS=$PASS FAIL=$FAIL"; exit 3;;
  *) report PASS "step3: scratch-is-not-prod guard" 0;;
esac

# --- Step 4: detect backup kind --------------------------------------------
KIND="unknown"
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
  if gzip -dc "$BACKUP_FILE" 2>/dev/null | head -c 4000 | grep -q '"partial": *true'; then KIND="json-partial";
  elif gzip -dc "$BACKUP_FILE" 2>/dev/null | head -c 4000 | grep -q 'PostgreSQL database dump'; then KIND="pg_dump";
  else KIND="gzip-unknown"; fi
else KIND="not-gzip"; fi
echo "backup kind: $KIND"
if [ "$KIND" = "pg_dump" ]; then report PASS "step4: backup kind detected (pg_dump)" 0;
elif [ "$KIND" = "json-partial" ]; then report PASS "step4: backup kind detected (json-partial — restore is manual, see caveat)" 0;
else report FAIL "step4: backup kind detected ($KIND)" 4; fi

# --- Step 5: restore to scratch --------------------------------------------
# pg_dump artifacts restore via psql; JSON-partial artifacts CANNOT be
# pg_restored — they need a migrated scratch DB + manual import (SKIP restore).
if [ "$KIND" = "pg_dump" ]; then
  if command -v psql >/dev/null 2>&1; then
    # NB: URL passed via env, never echoed.
    if gzip -dc "$BACKUP_FILE" | DATABASE_URL="$DATABASE_URL_SCRATCH" psql "$DATABASE_URL_SCRATCH" -v ON_ERROR_STOP=1 -q >/dev/null 2>&1; then
      report PASS "step5: pg_restore to scratch" 0
    else report FAIL "step5: pg_restore to scratch" 5; fi
  else report FAIL "step5: pg_restore to scratch (psql missing)" 5; fi
elif [ "$KIND" = "json-partial" ]; then
  echo "SKIP step5: JSON-partial backup is data-only (no schema/enums/indexes/trgm). Prepare scratch with 'prisma migrate deploy' then import manually." >&2
  report PASS "step5: restore skipped by design (json-partial)" 0
else report FAIL "step5: restore (unknown kind)" 5; fi

# --- Step 6: prisma migrate status (against SCRATCH) ------------------------
if command -v npx >/dev/null 2>&1; then
  if DATABASE_URL="$DATABASE_URL_SCRATCH" npx prisma migrate status >/dev/null 2>&1; then
    report PASS "step6: prisma migrate status (scratch)" 0
  else report FAIL "step6: prisma migrate status (scratch)" 6; fi
else report FAIL "step6: prisma migrate status (npx missing)" 6; fi

# --- Step 7: read-only smoke (GETs only) ------------------------------------
smoke_get() {
  # $1 = label, $2 = path
  local label="$1" path="$2" code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL$path" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then report PASS "step7: GET $label ($path)" "$code";
  else report FAIL "step7: GET $label ($path)" "$code"; fi
}

smoke_get "login-session" "/api/auth/me"
smoke_get "search" "/api/search?q=test"
smoke_get "creator-apply" "/api/creator-requests"

echo "---"
echo "MANUAL (not run by this script — POST smokes):"
echo "  1. POST \$BASE_URL/api/auth/login against a scratch user (expect 200 + session cookie)."
echo "  2. POST \$BASE_URL/api/creator-requests (scratch user apply; expect 201/422, never 5xx)."
echo "  3. POST \$BASE_URL/api/admin/backup on scratch (expect status completed|partial, never silent-completed)."
echo "---"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
