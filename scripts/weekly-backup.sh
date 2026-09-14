#!/usr/bin/env bash
# weekly-backup.sh — Weekly pg_dump backup with S3 upload and retention
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass()  { echo -e "${GREEN}✓ $*${NC}"; }
fail()  { echo -e "${RED}✗ $*${NC}" >&2; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }

# ─── Flags ────────────────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# ─── Config ───────────────────────────────────────────────────────────
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups/weekly"
FILENAME="db-${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
MANIFEST="${BACKUP_DIR}/db-${TIMESTAMP}.manifest.json"
RETENTION_COUNT=4
START_MS="$(date +%s%3N 2>/dev/null || date +%s)000"

if $DRY_RUN; then
  echo "[dry-run] mkdir -p $BACKUP_DIR"
  echo "[dry-run] pg_dump --format=custom --no-owner --no-privileges --schema=public \"\$DB_URL\" > $FILEPATH"
  echo "[dry-run] sha256sum $FILEPATH"
  echo "[dry-run] curl -T $FILEPATH \$BACKUP_S3_ENDPOINT/\$BACKUP_S3_BUCKET/\$BACKUP_S3_KEY/$FILENAME"
  echo "[dry-run] retention: keep last $RETENTION_COUNT dumps in $BACKUP_DIR"
  echo "[dry-run] manifest: $MANIFEST"
  exit 0
fi

DB_URL="${AIVEN_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  fail "No AIVEN_DATABASE_URL or DATABASE_URL set"
  echo '{"error":"missing database url","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi

# ─── pg_dump ──────────────────────────────────────────────────────────
if ! pg_dump --format=custom --no-owner --no-privileges --schema=public "$DB_URL" > "$FILEPATH" 2>/tmp/weekly-backup-stderr; then
  STDERR=$(cat /tmp/weekly-backup-stderr 2>/dev/null || echo "unknown error")
  fail "pg_dump failed: $STDERR"
  echo '{"error":"pg_dump failed","stderr":"'"$(echo "$STDERR" | head -c 500 | sed 's/"/\\"/g')"'","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  rm -f "$FILEPATH"
  exit 1
fi

if [[ ! -s "$FILEPATH" ]]; then
  fail "pg_dump produced empty file"
  echo '{"error":"empty dump","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  rm -f "$FILEPATH"
  exit 1
fi

END_MS="$(date +%s%3N 2>/dev/null || date +%s)000"
DURATION_MS=$((END_MS - START_MS))
pass "pg_dump completed: $FILEPATH"

# ─── SHA256 ───────────────────────────────────────────────────────────
SHA256=$(sha256sum "$FILEPATH" | awk '{print $1}')
pass "SHA256: $SHA256"

# ─── File size ────────────────────────────────────────────────────────
SIZE_BYTES=$(stat -c%s "$FILEPATH" 2>/dev/null || stat -f%z "$FILEPATH" 2>/dev/null || echo 0)
pass "Size: ${SIZE_BYTES} bytes"

# ─── Manifest ─────────────────────────────────────────────────────────
cat > "$MANIFEST" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "filename": "$FILENAME",
  "size_bytes": $SIZE_BYTES,
  "sha256": "$SHA256",
  "duration_ms": $DURATION_MS
}
EOF
pass "Manifest: $MANIFEST"

# ─── S3 Upload ────────────────────────────────────────────────────────
if [[ -n "${BACKUP_S3_ENDPOINT:-}" && -n "${BACKUP_S3_BUCKET:-}" && -n "${BACKUP_S3_KEY:-}" ]]; then
  S3_URL="${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}/${BACKUP_S3_KEY}/${FILENAME}"
  if curl -sf -T "$FILEPATH" -H "Content-Type: application/octet-stream" "$S3_URL"; then
    pass "S3 uploaded: $S3_URL"
  else
    fail "S3 upload failed: $S3_URL"
    echo '{"error":"s3 upload failed","url":"'"$S3_URL"'","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
    exit 1
  fi
else
  warn "S3 env vars not set — skipping upload"
fi

# ─── Retention: keep last N dumps ─────────────────────────────────────
DUMP_COUNT=$(find "$BACKUP_DIR" -name 'db-*.dump' -type f | wc -l)
if (( DUMP_COUNT > RETENTION_COUNT )); then
  DELETE_COUNT=$((DUMP_COUNT - RETENTION_COUNT))
  pass "Cleaning up $DELETE_COUNT old dump(s) (keeping last $RETENTION_COUNT)"
  find "$BACKUP_DIR" -name 'db-*.dump' -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -n \
    | head -n "$DELETE_COUNT" \
    | awk '{print $2}' \
    | xargs -r rm -f

  # Also remove corresponding manifests
  find "$BACKUP_DIR" -name 'db-*.manifest.json' -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -n \
    | head -n "$DELETE_COUNT" \
    | awk '{print $2}' \
    | xargs -r rm -f
fi

pass "Weekly backup complete: $FILENAME"
