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
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups/weekly"
FILENAME="db-${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
MANIFEST="${BACKUP_DIR}/db-${TIMESTAMP}.manifest.json"
RETENTION_COUNT=4
START_MS="$(date +%s%3N 2>/dev/null || date +%s)000"

if $DRY_RUN; then
  echo "[dry-run] verify ${PG_DUMP_BIN} major version >= 17 (bun run verify:pg)"
  echo "[dry-run] require DIRECT_URL (direct, non-pooled PostgreSQL URL)"
  echo "[dry-run] mkdir -p $BACKUP_DIR"
  echo "[dry-run] ${PG_DUMP_BIN} --format=custom --no-owner --no-privileges --schema=public \"\$DIRECT_URL\" > $FILEPATH"
  echo "[dry-run] ${PG_RESTORE_BIN} -l $FILEPATH >/dev/null  (TOC validation)"
  echo "[dry-run] sha256sum $FILEPATH"
  echo "[dry-run] aws --endpoint-url \$BACKUP_S3_ENDPOINT s3 cp $FILEPATH s3://\$BACKUP_S3_BUCKET/\$BACKUP_S3_KEY/$FILENAME"
  echo "[dry-run] retention: keep last $RETENTION_COUNT dumps in $BACKUP_DIR"
  echo "[dry-run] manifest: $MANIFEST"
  exit 0
fi

# ─── Database URL (DIRECT_URL only) ───────────────────────────────────
DB_URL="${DIRECT_URL:-}"
if [[ -z "$DB_URL" ]]; then
  fail "DIRECT_URL is required — backups need a direct (non-pooled) PostgreSQL URL"
  echo '{"error":"missing DIRECT_URL","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi
if [[ "${DB_URL,,}" == *-pooler* || "${DB_URL,,}" == *%2dpooler* || "${DB_URL,,}" == *%252dpooler* ]]; then
  fail "DIRECT_URL points at a pooled endpoint (-pooler) — use the direct Neon connection string"
  echo '{"error":"pooled DIRECT_URL rejected","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi
if [[ ! "$DB_URL" =~ ^postgres(ql)?:// ]]; then
  fail "DIRECT_URL must be a postgresql:// connection string"
  echo '{"error":"invalid DIRECT_URL","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi
pass "Database URL: DIRECT_URL (direct)"

# ─── pg_dump version (must be >= 17) ──────────────────────────────────
if ! command -v "$PG_DUMP_BIN" >/dev/null 2>&1; then
  fail "pg_dump not found: $PG_DUMP_BIN — install PostgreSQL 17 client tools or run: bun run verify:pg"
  exit 1
fi
if ! command -v "$PG_RESTORE_BIN" >/dev/null 2>&1; then
  fail "pg_restore not found: $PG_RESTORE_BIN — install PostgreSQL 17 client tools or run: bun run verify:pg"
  exit 1
fi
PG_DUMP_VERSION="$("$PG_DUMP_BIN" --version 2>&1)" || {
  fail "Unable to read pg_dump version: $PG_DUMP_BIN"
  exit 1
}
PG_DUMP_MAJOR="$(printf '%s\n' "$PG_DUMP_VERSION" | awk '{
  for (i = 1; i <= NF; i++) {
    if ($i ~ /^[0-9]+(\.[0-9]+)*$/) {
      split($i, parts, ".")
      print parts[1]
      exit
    }
  }
}')"
if [[ ! "$PG_DUMP_MAJOR" =~ ^[0-9]+$ ]] || ((PG_DUMP_MAJOR < 17)); then
  fail "pg_dump major version must be >= 17 (got: $PG_DUMP_VERSION) — run: bun run verify:pg"
  exit 1
fi
pass "pg_dump major: $PG_DUMP_MAJOR"

# ─── pg_dump ──────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STDERR_FILE="$(mktemp "${TMPDIR:-/tmp}/weekly-backup-stderr.XXXXXX")"
TMP_FILE="${FILEPATH}.partial"
cleanup() { rm -f "$TMP_FILE" "$STDERR_FILE"; }
trap cleanup EXIT

if ! "$PG_DUMP_BIN" --format=custom --no-owner --no-privileges --schema=public "$DB_URL" > "$TMP_FILE" 2>"$STDERR_FILE"; then
  STDERR=$(cat "$STDERR_FILE" 2>/dev/null || echo "unknown error")
  fail "pg_dump failed: $STDERR"
  echo '{"error":"pg_dump failed","stderr":"'"$(echo "$STDERR" | head -c 500 | sed 's/"/\\"/g')"'","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi

if [[ ! -s "$TMP_FILE" ]]; then
  fail "pg_dump produced empty file"
  echo '{"error":"empty dump","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi

if ! "$PG_RESTORE_BIN" -l "$TMP_FILE" >/dev/null 2>&1; then
  fail "pg_restore -l rejected the dump; refusing to publish a corrupt backup"
  echo '{"error":"corrupt dump","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
  exit 1
fi

chmod 600 "$TMP_FILE"
mv "$TMP_FILE" "$FILEPATH"
chmod 600 "$FILEPATH"
END_MS="$(date +%s%3N 2>/dev/null || date +%s)000"
DURATION_MS=$((END_MS - START_MS))
pass "pg_dump completed: $FILEPATH"

# ─── SHA256 ───────────────────────────────────────────────────────────
if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$FILEPATH" | awk '{print $1}')
else
  SHA256=$(shasum -a 256 "$FILEPATH" | awk '{print $1}')
fi
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
chmod 600 "$MANIFEST"
pass "Manifest: $MANIFEST"

# ─── S3 Upload ────────────────────────────────────────────────────────
if [[ -n "${BACKUP_S3_ENDPOINT:-}" && -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    fail "aws CLI not found — install it or unset BACKUP_S3_ENDPOINT/BUCKET (local dump kept)"
    echo '{"error":"aws cli missing","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
    exit 1
  fi
  if [[ -n "${BACKUP_S3_ACCESS_KEY:-}" && -n "${BACKUP_S3_SECRET_KEY:-}" ]]; then
    export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
  elif [[ -n "${BACKUP_S3_ACCESS_KEY:-}" || -n "${BACKUP_S3_SECRET_KEY:-}" ]]; then
    fail "S3 credentials incomplete: set both BACKUP_S3_ACCESS_KEY and BACKUP_S3_SECRET_KEY (or neither to use the AWS credential chain)"
    echo '{"error":"incomplete s3 credentials","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
    exit 1
  else
    warn "S3 access keys not set — using the AWS credential chain (instance role / profile)"
  fi

  S3_PREFIX="${BACKUP_S3_KEY:-}"
  S3_PREFIX="${S3_PREFIX#/}"
  S3_PREFIX="${S3_PREFIX%/}"
  S3_BASE="s3://${BACKUP_S3_BUCKET}"
  if [[ -n "$S3_PREFIX" ]]; then
    S3_BASE="${S3_BASE}/${S3_PREFIX}"
  fi
  S3_AWS_ARGS=(--endpoint-url "${BACKUP_S3_ENDPOINT%/}")
  if [[ -n "${BACKUP_S3_REGION:-}" ]]; then
    S3_AWS_ARGS+=(--region "$BACKUP_S3_REGION")
  fi

  if aws "${S3_AWS_ARGS[@]}" s3 cp "$FILEPATH" "${S3_BASE}/${FILENAME}" --only-show-errors     && aws "${S3_AWS_ARGS[@]}" s3 cp "$MANIFEST" "${S3_BASE}/$(basename "$MANIFEST")" --only-show-errors; then
    pass "S3 uploaded: ${S3_BASE}/${FILENAME}"
  else
    fail "S3 upload failed: ${S3_BASE}/${FILENAME} (local dump kept)"
    echo '{"error":"s3 upload failed","url":"'"${S3_BASE}/${FILENAME}"'","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >&2
    exit 1
  fi
else
  warn "S3 env vars not set — skipping upload"
fi

# ─── Retention: keep last N dumps ─────────────────────────────────────
mapfile -t DUMPS < <(ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null || true)
if (( ${#DUMPS[@]} > RETENTION_COUNT )); then
  DELETE_COUNT=$(( ${#DUMPS[@]} - RETENTION_COUNT ))
  pass "Cleaning up $DELETE_COUNT old dump(s) (keeping last $RETENTION_COUNT)"
  for ((i = RETENTION_COUNT; i < ${#DUMPS[@]}; i++)); do
    rm -f -- "${DUMPS[i]}"
  done
fi

# Remove manifests whose dump no longer exists.
shopt -s nullglob
for manifest in "$BACKUP_DIR"/db-*.manifest.json; do
  stem="${manifest%.manifest.json}"
  if [[ ! -f "${stem}.dump" ]]; then
    rm -f -- "$manifest"
  fi
done
shopt -u nullglob

pass "Weekly backup complete: $FILENAME"
