#!/usr/bin/env bash
#
# migrate-to-neon.sh — Aiven (source) -> Neon (target) schema + data migration
#
# Usage:
#   NEON_DIRECT_URL=... ./scripts/migrate-to-neon.sh
#   SOURCE_URL=... NEON_DIRECT_URL=... SOURCE_FROZEN=yes CONFIRM_RESTORE=yes \
#     ./scripts/migrate-to-neon.sh --execute
#   SOURCE_URL=... NEON_DIRECT_URL=... SOURCE_FROZEN=yes CONFIRM_RESTORE=yes \
#     ./scripts/migrate-to-neon.sh --execute [--check-prisma]
#
# Safety:
#   - DRY-RUN by default: prints the planned commands with credentials redacted.
#   - --execute is required to dump/restore; CONFIRM_RESTORE=yes is required too.
#   - --execute requires an explicit SOURCE_URL and SOURCE_FROZEN=yes. A source
#     URL read from .env/--env-file is rejected unless ALLOW_SOURCE_FROM_ENV_FILE=yes
#     is set, because a post-cutover .env points at Neon, not Aiven.
#   - SOURCE_URL and NEON_DIRECT_URL must both be direct (no "-pooler") and must
#     not resolve to the same host+database. Encoded/trailing-dot pooler hosts
#     are normalized and rejected.
#   - --execute refuses a non-empty target public schema unless
#     ALLOW_NONEMPTY_TARGET=yes. Use a fresh Neon branch for the restore.
#   - NEON_DIRECT_URL must target the same Neon branch/database as the app's
#     pooled endpoint. A URL does not identify the branch, so this is an
#     operational precondition the script cannot infer.
#   - Requires PostgreSQL 17 client tools (pg_dump, pg_restore, psql).
#   - The dump is written outside the repository (default /tmp/neon-migration).
#   - The restore uses --single-transaction --exit-on-error and never uses -j.
#   - _prisma_migrations and _prisma_migrations_backup_20260920 are preserved.
#   - Never prints connection URLs containing credentials.
#
# This script never runs `prisma migrate dev` or `prisma db push`.
#
set -euo pipefail
umask 077

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
NC=$'\033[0m'

pass() { printf '%s[PASS]%s %s\n' "$GREEN" "$NC" "$1"; }
fail() { printf '%s[FAIL]%s %s\n' "$RED" "$NC" "$1" >&2; }
info() { printf '%s[INFO]%s %s\n' "$CYAN" "$NC" "$1"; }
warn() { printf '%s[WARN]%s %s\n' "$YELLOW" "$NC" "$1"; }
die() { fail "$1"; exit "${2:-1}"; }

usage() {
  cat <<'EOF'
Usage:
  NEON_DIRECT_URL=... ./scripts/migrate-to-neon.sh
  NEON_DIRECT_URL=... ./scripts/migrate-to-neon.sh
  SOURCE_URL=... NEON_DIRECT_URL=... SOURCE_FROZEN=yes CONFIRM_RESTORE=yes \
    ./scripts/migrate-to-neon.sh --execute
  SOURCE_URL=... NEON_DIRECT_URL=... SOURCE_FROZEN=yes CONFIRM_RESTORE=yes \
    ./scripts/migrate-to-neon.sh --execute [--check-prisma]

Environment:
  SOURCE_URL             Aiven direct PostgreSQL URL. For --execute this must be
                         set explicitly; .env/--env-file fallback is refused
                         unless ALLOW_SOURCE_FROM_ENV_FILE=yes.
  NEON_DIRECT_URL        Neon direct PostgreSQL URL, no "-pooler" (required).
  SOURCE_FROZEN=yes      Required with --execute: stop all app writes to Aiven.
  CONFIRM_RESTORE=yes    Required with --execute.
  ALLOW_SOURCE_FROM_ENV_FILE=yes
                         Allow the execute source URL to come from .env.
  ALLOW_ACTIVE_SOURCE=yes
                         Allow active source DDL/DML sessions (not recommended).
  ALLOW_NONEMPTY_TARGET=yes
                         Allow restoring into a non-empty public schema.
  MIGRATION_WORKDIR      Dump directory (default: /tmp/neon-migration).
  EXPECTED_TABLE_COUNT   Expected public TABLE entries in the TOC (default: 98).
  PG_DUMP_BIN            pg_dump binary override.
  PG_RESTORE_BIN         pg_restore binary override.
  PSQL_BIN               psql binary override.

Options:
  --env-file PATH        Load SOURCE_URL, DATABASE_URL, and NEON_DIRECT_URL
                         from PATH (default: .env). Explicit environment
                         variables win over values from the file.
  --execute              Dump the source and restore into the Neon target.
  --check-prisma         After verification, apply pending Prisma migrations to
                         the target and verify their ledger rows explicitly.
  --dry-run              Dry-run only (default): validate and print commands.
EOF
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd -P)
VERIFY_SQL="$SCRIPT_DIR/verify-migration.sql"

EXECUTE=false
CHECK_PRISMA=false
ENV_FILE=""
ENV_FILE_EXPLICIT=false

while (($#)); do
  case "$1" in
    --execute) EXECUTE=true ;;
    --dry-run) EXECUTE=false ;;
    --check-prisma) CHECK_PRISMA=true ;;
    --env-file)
      (($# >= 2)) || die "--env-file requires a path." 2
      ENV_FILE="$2"
      ENV_FILE_EXPLICIT=true
      shift
      ;;
    --env-file=*)
      ENV_FILE="${1#*=}"
      ENV_FILE_EXPLICIT=true
      ;;
    -h|--help) usage; exit 0 ;;
    *)
      usage >&2
      die "Unknown argument: $1" 2
      ;;
  esac
  shift
done

if $ENV_FILE_EXPLICIT; then
  [[ -n "$ENV_FILE" ]] || die "--env-file requires a non-empty path." 2
  [[ -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE" 2
elif [[ -n "${SOURCE_URL:-}" || -n "${DATABASE_URL:-}" ]] && [[ -n "${NEON_DIRECT_URL:-}" ]]; then
  ENV_FILE=""
else
  ENV_FILE="$REPO_ROOT/.env"
  [[ -f "$ENV_FILE" ]] || ENV_FILE=""
fi

FILE_SOURCE_URL=""
FILE_DATABASE_URL=""
FILE_NEON_DIRECT_URL=""
SOURCE_FROM_FILE=false
if [[ -n "$ENV_FILE" ]]; then
  # Parse only the keys this script needs. Do NOT source .env: sourcing would
  # overwrite internal variables (e.g. EXECUTE) and could leak unrelated secrets.
  if ! command -v python3 >/dev/null 2>&1; then
    die "python3 is required to read --env-file / .env." 1
  fi
  if ! command -v base64 >/dev/null 2>&1; then
    die "base64 is required to read --env-file / .env." 1
  fi
  if ! ENV_LINES=$(python3 - "$ENV_FILE" <<'PY'
import base64
import sys

wanted = ("SOURCE_URL", "DATABASE_URL", "NEON_DIRECT_URL")
values = {key: "" for key in wanted}

try:
    with open(sys.argv[1], "r", encoding="utf-8-sig") as handle:
        for raw in handle:
            line = raw.rstrip("\r\n").lstrip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key not in values:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            values[key] = value
except (OSError, UnicodeError):
    raise SystemExit("cannot read env file")

for key in wanted:
    sys.stdout.write("x" + base64.b64encode(values[key].encode("utf-8")).decode("ascii") + "\n")
PY
  ); then
    die "Could not read env file: $ENV_FILE" 2
  fi
  mapfile -t ENV_LINES <<<"$ENV_LINES"
  if [[ ${#ENV_LINES[@]} -ne 3 ]]; then
    die "Could not parse env file: $ENV_FILE" 2
  fi
  FILE_SOURCE_URL=$(printf '%s' "${ENV_LINES[0]#x}" | base64 -d)
  FILE_DATABASE_URL=$(printf '%s' "${ENV_LINES[1]#x}" | base64 -d)
  FILE_NEON_DIRECT_URL=$(printf '%s' "${ENV_LINES[2]#x}" | base64 -d)
  unset ENV_LINES
fi

if [[ -z "${SOURCE_URL:-}" && -n "$FILE_SOURCE_URL" ]]; then
  SOURCE_URL="$FILE_SOURCE_URL"
  SOURCE_FROM_FILE=true
fi
if [[ -z "${SOURCE_URL:-}" && -n "${DATABASE_URL:-}" ]]; then
  SOURCE_URL="$DATABASE_URL"
fi
if [[ -z "${SOURCE_URL:-}" && -n "$FILE_DATABASE_URL" ]]; then
  SOURCE_URL="$FILE_DATABASE_URL"
  SOURCE_FROM_FILE=true
fi
if [[ -z "${NEON_DIRECT_URL:-}" && -n "$FILE_NEON_DIRECT_URL" ]]; then
  NEON_DIRECT_URL="$FILE_NEON_DIRECT_URL"
fi
unset DATABASE_URL FILE_SOURCE_URL FILE_DATABASE_URL FILE_NEON_DIRECT_URL

if [[ -z "${SOURCE_URL:-}" ]]; then
  die "SOURCE_URL is required (or DATABASE_URL from the environment, --env-file, or .env)." 2
fi
if [[ -z "${NEON_DIRECT_URL:-}" ]]; then
  die "NEON_DIRECT_URL is required (Neon direct, non-pooler connection URL)." 2
fi

# The target must be the direct endpoint. A pooled endpoint cannot run DDL
# reliably and is not the same connection path as Neon's direct migration URL.
case "${NEON_DIRECT_URL,,}" in
  *-pooler*)
    die "NEON_DIRECT_URL must not contain '-pooler'; use the direct endpoint." 2
    ;;
esac

if $EXECUTE; then
  [[ "${CONFIRM_RESTORE:-}" == "yes" ]] || die "Refusing --execute without CONFIRM_RESTORE=yes." 2
  [[ "${SOURCE_FROZEN:-}" == "yes" ]] || die "Refusing --execute without SOURCE_FROZEN=yes. Stop all writes to the Aiven source first." 2
  if $SOURCE_FROM_FILE && [[ "${ALLOW_SOURCE_FROM_ENV_FILE:-}" != "yes" ]]; then
    die "Refusing to use SOURCE_URL/DATABASE_URL from an env file for --execute. Pass SOURCE_URL explicitly (or set ALLOW_SOURCE_FROM_ENV_FILE=yes)." 2
  fi
fi

# ---------------------------------------------------------------------------
# PostgreSQL 17 client tools
# ---------------------------------------------------------------------------
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
PSQL_BIN="${PSQL_BIN:-psql}"

check_pg_client() {
  local label="$1" bin="$2" version major

  if ! command -v "$bin" >/dev/null 2>&1; then
    fail "$label not found: $bin"
    cat >&2 <<'EOF'
PostgreSQL 17 client tools are required (the source is PostgreSQL 17).
Install postgresql-client-17, use the official postgres:17 image, or set
PG_DUMP_BIN / PG_RESTORE_BIN / PSQL_BIN to the v17 executables.
EOF
    exit 1
  fi

  if ! version=$("$bin" --version 2>/dev/null); then
    fail "Could not read the version of $label ($bin)."
    exit 1
  fi

  major=$(printf '%s\n' "$version" | sed -nE 's/.*PostgreSQL\) ([0-9]+).*/\1/p' | head -n1)
  if [[ -z "$major" ]]; then
    fail "Could not parse the PostgreSQL major version from: $version"
    exit 1
  fi
  if (( major < 17 )); then
    fail "$label is PostgreSQL $major; version 17 or newer is required."
    cat >&2 <<'EOF'
Install postgresql-client-17, use the official postgres:17 image, or set
PG_DUMP_BIN / PG_RESTORE_BIN / PSQL_BIN to the v17 executables.
EOF
    exit 1
  fi

  pass "$label: $version"
}

check_pg_client "pg_dump" "$PG_DUMP_BIN"
check_pg_client "pg_restore" "$PG_RESTORE_BIN"
check_pg_client "psql" "$PSQL_BIN"

if ! command -v python3 >/dev/null 2>&1; then
  die "python3 is required for URL validation/cleaning." 1
fi
if ! command -v sha256sum >/dev/null 2>&1; then
  die "sha256sum is required for the dump checksum." 1
fi
if ! command -v realpath >/dev/null 2>&1; then
  die "realpath is required to validate MIGRATION_WORKDIR." 1
fi
if [[ ! -f "$VERIFY_SQL" ]]; then
  die "Verification SQL not found: $VERIFY_SQL" 1
fi

# ---------------------------------------------------------------------------
# URL validation + cleaning for libpq tools
# ---------------------------------------------------------------------------
# Prisma-only query parameters are removed. connect_timeout is valid for libpq
# and is deliberately preserved. The cleaned URLs are never printed.
export SOURCE_URL NEON_DIRECT_URL
URL_OUTPUT=""
if ! URL_OUTPUT=$(python3 - <<'PY'
import os
import sys
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit, urlunsplit

# Prisma-only parameters. `schema` is rejected rather than dropped because
# dropping it would silently migrate `public` instead of the requested schema.
DROP = {
    "connection_limit",
    "pool_timeout",
    "statement_timeout",
    "statement_cache_size",
    "pgbouncer",
    "socket_timeout",
}


def clean(raw, label):
    if any(ch in raw for ch in ("\n", "\r", "\0")):
        raise SystemExit(f"{label}: URL contains a control character")
    if raw != raw.strip():
        raise SystemExit(f"{label}: URL has leading or trailing whitespace")

    try:
        parts = urlsplit(raw)
        parts.port  # validate the port early
        hostname = parts.hostname
    except ValueError:
        raise SystemExit(f"{label}: invalid PostgreSQL URL")

    if parts.scheme not in {"postgres", "postgresql"}:
        raise SystemExit(f"{label}: scheme must be postgres:// or postgresql://")
    if not hostname:
        raise SystemExit(f"{label}: URL is missing a host")
    if not parts.path or parts.path == "/":
        raise SystemExit(f"{label}: URL is missing a database name")
    if parts.fragment:
        raise SystemExit(f"{label}: URL fragment is not supported")

    database = unquote(parts.path.lstrip("/"))
    if not database:
        raise SystemExit(f"{label}: URL is missing a database name")

    # Normalize the host for pooler/equality checks. Percent-encoded hosts and
    # a trailing DNS root dot must not bypass the "-pooler" guard.
    normalized_host = unquote(hostname).rstrip(".").lower()
    if "-pooler" in normalized_host:
        raise SystemExit(f"{label}: must be a direct (non-pooler) endpoint")

    raw_query = parse_qsl(parts.query, keep_blank_values=True)
    if any(key.lower() == "schema" for key, _ in raw_query):
        raise SystemExit(f"{label}: Prisma `schema` param is not supported; this script migrates public")
    query = [(key, value) for key, value in raw_query if key.lower() not in DROP]
    cleaned = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query, doseq=True, quote_via=quote), "")
    )
    return cleaned, (normalized_host, database)


source, source_key = clean(os.environ["SOURCE_URL"], "SOURCE_URL")
target, target_key = clean(os.environ["NEON_DIRECT_URL"], "NEON_DIRECT_URL")

if source_key == target_key:
    raise SystemExit("SOURCE_URL and NEON_DIRECT_URL point to the same host and database")


def display_key(key):
    host, database = key
    safe_database = database.encode("unicode_escape").decode("ascii")
    return host + "/" + safe_database


sys.stdout.write(
    source + "\n" + target + "\n"
    + display_key(source_key) + "\n"
    + display_key(target_key) + "\n"
)
PY
); then
  die "URL validation/cleaning failed; no URL was printed." 2
fi

mapfile -t CLEAN_URLS <<<"$URL_OUTPUT"
if [[ ${#CLEAN_URLS[@]} -ne 4 ]]; then
  die "URL validation did not return two cleaned URLs and two display keys." 2
fi

CLEAN_SOURCE="${CLEAN_URLS[0]}"
CLEAN_TARGET="${CLEAN_URLS[1]}"
SOURCE_DISPLAY="${CLEAN_URLS[2]}"
TARGET_DISPLAY="${CLEAN_URLS[3]}"
unset URL_OUTPUT CLEAN_URLS SOURCE_URL NEON_DIRECT_URL

# ---------------------------------------------------------------------------
# Work directory, dump path, temporary files
# ---------------------------------------------------------------------------
RAW_WORKDIR="${MIGRATION_WORKDIR:-/tmp/neon-migration}"
if [[ -L "$RAW_WORKDIR" ]]; then
  die "MIGRATION_WORKDIR must not be a symlink: $RAW_WORKDIR" 2
fi
if ! WORKDIR=$(realpath -m -- "$RAW_WORKDIR"); then
  die "Could not resolve MIGRATION_WORKDIR." 2
fi

case "$WORKDIR" in
  "$REPO_ROOT"|"$REPO_ROOT"/*)
    die "MIGRATION_WORKDIR must not be inside the repository: $REPO_ROOT" 2
    ;;
esac

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$WORKDIR/aiven-to-neon-$STAMP.dump"
CHECKSUM="$DUMP.sha256"
MANIFEST_SOURCE_TABLES="$WORKDIR/source-tables.tsv"
MANIFEST_SOURCE_OBJECTS="$WORKDIR/source-objects.tsv"
MANIFEST_SOURCE_LEDGER="$WORKDIR/source-prisma-ledger.tsv"
MANIFEST_TARGET_TABLES="$WORKDIR/target-tables.tsv"
MANIFEST_TARGET_OBJECTS="$WORKDIR/target-objects.tsv"
MANIFEST_TARGET_LEDGER="$WORKDIR/target-prisma-ledger.tsv"

EXPECTED_TABLE_COUNT="${EXPECTED_TABLE_COUNT:-98}"
if [[ ! "$EXPECTED_TABLE_COUNT" =~ ^[0-9]+$ ]] || (( EXPECTED_TABLE_COUNT < 1 )); then
  die "EXPECTED_TABLE_COUNT must be a positive integer." 2
fi

TOC_RAW=""
TOC_FILTERED=""
cleanup() {
  if [[ -n "$TOC_RAW" && -f "$TOC_RAW" ]]; then
    rm -f -- "$TOC_RAW"
  fi
  if [[ -n "$TOC_FILTERED" && -f "$TOC_FILTERED" ]]; then
    rm -f -- "$TOC_FILTERED"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

count_table_entries() {
  awk '$4 == "TABLE" && $5 == "public" { n++ } END { print n + 0 }' "$1"
}

count_extension_entries() {
  awk '$4 == "EXTENSION" { n++ } END { print n + 0 }' "$1"
}

has_table_entry() {
  awk -v want="$2" '
    $4 == "TABLE" && $5 == "public" {
      name = $6
      gsub(/"/, "", name)
      if (name == want) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$1"
}

has_public_schema_entry() {
  awk '$4 == "SCHEMA" && $5 == "-" && $6 == "public" { found = 1 } END { exit(found ? 0 : 1) }' "$1"
}

has_public_schema_comment() {
  awk '$4 == "COMMENT" && $5 == "-" && $6 == "SCHEMA" && $7 == "public" { found = 1 } END { exit(found ? 0 : 1) }' "$1"
}

psql_scalar() {
  "$PSQL_BIN" -X "$1" -v ON_ERROR_STOP=1 -tA -c "$2" | tr -d '[:space:]'
}

# The source ledger must be exactly the expected pre-cutover shape. This script
# restores the source's _prisma_migrations table verbatim; if the branch's new
# extension migration was already applied to Aiven, the restore would contain a
# ledger row that cannot be reproduced on a fresh target.
validate_source_ledger() {
  local total applied rolled_back duplicate backup_applied
  total=$(psql_scalar "$CLEAN_SOURCE" \
    'SELECT count(*) FROM public._prisma_migrations;') || die "Could not read source _prisma_migrations." 1
  applied=$(psql_scalar "$CLEAN_SOURCE" \
    'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;') || die "Could not read source applied migrations." 1
  rolled_back=$(psql_scalar "$CLEAN_SOURCE" \
    'SELECT count(*) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL;') || die "Could not read source rolled-back migrations." 1
  duplicate=$(psql_scalar "$CLEAN_SOURCE" \
    "SELECT count(*) FROM public._prisma_migrations WHERE migration_name = '20261008000000_team_owner_unique';") || die "Could not read source duplicate migration row." 1
  backup_applied=$(psql_scalar "$CLEAN_SOURCE" \
    'SELECT count(*) FROM public._prisma_migrations_backup_20260920;') || die "Could not read source migration backup table." 1

  info "Source Prisma ledger: total=$total applied=$applied rolled_back=$rolled_back duplicate=$duplicate backup_rows=$backup_applied"
  if [[ "$total" != "19" || "$applied" != "18" || "$rolled_back" != "1" || "$duplicate" != "2" ]]; then
    die "Source Prisma ledger is not 19 total / 18 applied / 1 rolled back / 2 duplicate rows. Do not apply branch migrations to Aiven; use the pre-cutover branch state or resolve the ledger explicitly." 1
  fi
  if [[ "$backup_applied" != "18" ]]; then
    die "Source _prisma_migrations_backup_20260920 has $backup_applied rows, expected 18." 1
  fi
}

# SOURCE_FROZEN=yes is the primary guard. This is a best-effort second check for
# active DDL/DML statements from other sessions at preflight time.
check_source_frozen() {
  local active
  if ! active=$(psql_scalar "$CLEAN_SOURCE" "
    SELECT count(*) FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND state = 'active'
      AND query ~* '^[[:space:]]*(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|comment|copy)[[:space:]]';
  " 2>/dev/null); then
    warn "Could not inspect pg_stat_activity on the source; relying on SOURCE_FROZEN=yes."
    return 0
  fi
  if [[ "$active" != "0" && "${ALLOW_ACTIVE_SOURCE:-}" != "yes" ]]; then
    die "Source has $active active DDL/DML session(s). Stop writes and retry, or set ALLOW_ACTIVE_SOURCE=yes only if you understand the risk." 1
  fi
  pass "Source has no active DDL/DML sessions (frozen guard satisfied)."
}

# A restore into a used branch would silently merge/overwrite objects. Require a
# fresh Neon branch unless the operator explicitly accepts a non-empty target.
ensure_target_empty() {
  local objects
  objects=$(psql_scalar "$CLEAN_TARGET" "
    SELECT count(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p','v','m','S','f');
  ") || die "Could not inspect target public schema." 1
  if [[ "$objects" != "0" ]]; then
    if [[ "${ALLOW_NONEMPTY_TARGET:-}" == "yes" ]]; then
      warn "Target public schema already has $objects relation(s); ALLOW_NONEMPTY_TARGET=yes set. Ensure this branch is disposable."
    else
      die "Target public schema is not empty ($objects relations). Restore into a fresh Neon branch or set ALLOW_NONEMPTY_TARGET=yes after verifying it is disposable." 1
    fi
  fi
  pass "Target public schema is empty (fresh branch)."
}

# The rolled-back duplicate migration is safe to reapply only when there are no
# duplicate Team.ownerId values. Check on the restored target before migrate deploy.
validate_target_team_owner_uniqueness() {
  local duplicates
  duplicates=$(psql_scalar "$CLEAN_TARGET" '
    SELECT count(*) FROM (
      SELECT "ownerId" FROM public."Team"
      WHERE "ownerId" IS NOT NULL
      GROUP BY "ownerId" HAVING count(*) > 1
    ) d;
  ') || die "Could not check Team.ownerId duplicates on the target." 1
  if [[ "$duplicates" != "0" ]]; then
    die "Target has $duplicates duplicate Team.ownerId value(s). Resolve them before `prisma migrate deploy`; the rolled-back unique-index migration cannot be reapplied." 1
  fi
  pass "Target Team.ownerId uniqueness check passed."
}

capture_table_manifest() {
  local url="$1" out="$2"
  "$PSQL_BIN" -X "$url" -v ON_ERROR_STOP=1 -tA -F $'\t' -c "
    SELECT c.relname,
           (xpath('/row/c/text()', query_to_xml(
             format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
             false, true, ''
           )))[1]::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  " > "$out" || die "Could not capture table manifest from ${url%%:*} URL." 1
}

capture_object_manifest() {
  local url="$1" out="$2"
  "$PSQL_BIN" -X "$url" -v ON_ERROR_STOP=1 -tA -c "
    SELECT 'index=' || count(*) FROM pg_indexes WHERE schemaname = 'public'
    UNION ALL
    SELECT 'constraint=' || count(*) FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'enum=' || count(*) FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'
    UNION ALL
    SELECT 'gin=' || count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND indexdef ILIKE '%USING gin%'
    UNION ALL
    SELECT 'sequence=' || count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'S'
    UNION ALL
    SELECT 'trigger=' || count(*) FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY 1;
  " > "$out" || die "Could not capture object manifest." 1
}

capture_ledger_manifest() {
  local url="$1" out="$2"
  "$PSQL_BIN" -X "$url" -v ON_ERROR_STOP=1 -tA -F $'\t' -c "
    SELECT migration_name, coalesce(checksum, ''),
           (finished_at IS NOT NULL)::text, (rolled_back_at IS NOT NULL)::text
    FROM public._prisma_migrations
    ORDER BY started_at, migration_name;
  " > "$out" || die "Could not capture Prisma ledger manifest." 1
}

assert_manifest_match() {
  local label="$1" source_file="$2" target_file="$3" diff_file="$WORKDIR/manifest-${label}.diff"
  if ! diff -u "$source_file" "$target_file" > "$diff_file"; then
    fail "Post-restore $label manifest differs from the source:"
    sed -n '1,80p' "$diff_file" >&2
    die "Refusing to declare the migration verified; investigate the $label diff." 1
  fi
  pass "Post-restore $label manifest matches the source."
}

assert_toc_has_no_unexpected_kinds() {
  local toc="$1" kind count
  for kind in FUNCTION VIEW TRIGGER SEQUENCE; do
    count=$(awk -v want="$kind" '$4 == want { n++ } END { print n + 0 }' "$toc")
    if [[ "$count" != "0" ]]; then
      die "TOC contains $count $kind entries; this script only supports TABLE/TABLE DATA/INDEX/CONSTRAINT/DEFAULT/COMMENT/ACL/TYPE entries. Refusing to restore." 1
    fi
  done
  count=$(awk '$4 == "MATERIALIZED" && $5 == "VIEW" { n++ } END { print n + 0 }' "$toc")
  if [[ "$count" != "0" ]]; then
    die "TOC contains $count MATERIALIZED VIEW entries; refusing to restore." 1
  fi
}

validate_existing_workdir() {
  if [[ ! -e "$WORKDIR" ]]; then
    return 0
  fi
  if [[ ! -d "$WORKDIR" ]]; then
    die "MIGRATION_WORKDIR exists but is not a directory: $WORKDIR" 2
  fi
  local mode
  mode=$(stat -c '%a' -- "$WORKDIR") || die "Could not read MIGRATION_WORKDIR mode: $WORKDIR" 2
  if [[ "$mode" != "700" ]]; then
    die "Existing MIGRATION_WORKDIR must already be mode 700: $WORKDIR (found $mode)" 2
  fi
}

validate_existing_workdir

# ---------------------------------------------------------------------------
# Dry-run
# ---------------------------------------------------------------------------
if ! $EXECUTE; then
  echo
  echo "=== Aiven -> Neon migration (DRY RUN) ==="
  info "Source: (redacted) $SOURCE_DISPLAY"
  info "Target: (redacted, direct/non-pooler) $TARGET_DISPLAY"
  info "Work dir: $WORKDIR"
  info "Dump file: $DUMP"
  info "Expected public TABLE entries: $EXPECTED_TABLE_COUNT"
  echo
  echo "Planned commands (credentials redacted):"
  cat <<EOF
  mkdir -p -- "$WORKDIR" && chmod 700 -- "$WORKDIR"
  "$PG_DUMP_BIN" '<SOURCE_URL_CLEAN>' --format=custom --schema=public --no-tablespaces --lock-wait-timeout=30s --file="$DUMP"
  sha256sum -- "$DUMP" > "$CHECKSUM"
  "$PG_RESTORE_BIN" -l "$DUMP" > "<TOC_RAW>"
  # Fail unless: TABLE entries == $EXPECTED_TABLE_COUNT, EXTENSION entries == 0,
  # and both _prisma_migrations + _prisma_migrations_backup_20260920 are present.
  # Filter SCHEMA - public and COMMENT - SCHEMA public into "<TOC_FILTERED>".
  "$PSQL_BIN" -X '<NEON_DIRECT_URL_CLEAN>' -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;' -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
  "$PG_RESTORE_BIN" --dbname='<NEON_DIRECT_URL_CLEAN>' --use-list="<TOC_FILTERED>" --clean --if-exists --no-owner --no-privileges --no-tablespaces --single-transaction --exit-on-error "$DUMP"
  "$PSQL_BIN" -X '<NEON_DIRECT_URL_CLEAN>' -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"
EOF
  if $CHECK_PRISMA; then
    echo "  DATABASE_URL='<NEON_DIRECT_URL_CLEAN>' DIRECT_URL='<NEON_DIRECT_URL_CLEAN>' npx prisma migrate deploy"
    echo "  # then verify 20261023000000_add_neon_extensions is finished and no failed rows remain"
  fi
  echo
  info "No database connection, dump, or restore was attempted."
  info "Re-run with --execute and CONFIRM_RESTORE=yes to perform the migration."
  exit 0
fi

# ---------------------------------------------------------------------------
# Execute — step 1: dump
# ---------------------------------------------------------------------------
echo
echo "=== Aiven -> Neon migration (EXECUTE) ==="
info "Source: (redacted) $SOURCE_DISPLAY"
info "Target: (redacted, direct/non-pooler) $TARGET_DISPLAY"
info "Work dir: $WORKDIR"
info "Dump file: $DUMP"
info "Expected public TABLE entries: $EXPECTED_TABLE_COUNT"

if [[ ! -e "$WORKDIR" ]]; then
  mkdir -p -- "$WORKDIR" || die "Could not create MIGRATION_WORKDIR: $WORKDIR" 2
  chmod 700 -- "$WORKDIR" || die "Could not secure MIGRATION_WORKDIR: $WORKDIR" 2
fi

if [[ -e "$DUMP" || -e "$CHECKSUM" ]]; then
  die "Refusing to overwrite an existing dump or checksum: $DUMP" 2
fi

info "Preflight: validating the source ledger, freeze guard, and empty target ..."
validate_source_ledger
check_source_frozen
ensure_target_empty

info "Capturing source manifests for post-restore comparison ..."
capture_table_manifest "$CLEAN_SOURCE" "$MANIFEST_SOURCE_TABLES"
capture_object_manifest "$CLEAN_SOURCE" "$MANIFEST_SOURCE_OBJECTS"
capture_ledger_manifest "$CLEAN_SOURCE" "$MANIFEST_SOURCE_LEDGER"
pass "Source manifests captured."

info "Step 1/6: pg_dump from the source (Aiven) ..."
if ! "$PG_DUMP_BIN" "$CLEAN_SOURCE" \
  --format=custom \
  --schema=public \
  --no-tablespaces \
  --lock-wait-timeout=30s \
  --file="$DUMP"; then
  fail "pg_dump failed. A partial dump may exist at $DUMP; do not restore it."
  exit 1
fi

if [[ ! -s "$DUMP" ]]; then
  die "pg_dump produced an empty dump; refusing to restore." 1
fi

SIZE_BYTES=$(stat -c '%s' -- "$DUMP")
pass "Dump created: $DUMP ($SIZE_BYTES bytes)"

# ---------------------------------------------------------------------------
# Execute — step 2: checksum + TOC validation
# ---------------------------------------------------------------------------
info "Step 2/6: checksum and TOC validation ..."
sha256sum -- "$DUMP" > "$CHECKSUM"
SHA256=$(awk '{print $1}' "$CHECKSUM")
if [[ ! "$SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  die "Invalid SHA256 checksum file: $CHECKSUM" 1
fi
pass "SHA256: $SHA256"

TOC_RAW=$(mktemp "$WORKDIR/toc.raw.XXXXXX")
if ! "$PG_RESTORE_BIN" -l "$DUMP" > "$TOC_RAW"; then
  die "pg_restore -l failed; refusing to restore." 1
fi

TABLE_COUNT=$(count_table_entries "$TOC_RAW")
EXTENSION_COUNT=$(count_extension_entries "$TOC_RAW")

info "TOC TABLE entries: $TABLE_COUNT (expected $EXPECTED_TABLE_COUNT)"
info "TOC EXTENSION entries: $EXTENSION_COUNT (expected 0)"

if [[ "$TABLE_COUNT" -ne "$EXPECTED_TABLE_COUNT" ]]; then
  die "TOC table count mismatch; refusing to restore." 1
fi
if [[ "$EXTENSION_COUNT" -ne 0 ]]; then
  die "TOC contains extension entries; pg_dump --schema=public should omit them. Refusing to restore." 1
fi

for required_table in _prisma_migrations _prisma_migrations_backup_20260920; do
  if ! has_table_entry "$TOC_RAW" "$required_table"; then
    die "Required table '$required_table' is missing from the TOC; refusing to restore." 1
  fi
done
pass "TOC contains all required table entries."

# ---------------------------------------------------------------------------
# Execute — step 3: filter schema/comment entries
# ---------------------------------------------------------------------------
info "Step 3/6: filtering public schema entries from the TOC ..."
TOC_FILTERED=$(mktemp "$WORKDIR/toc.filtered.XXXXXX")
awk '
  $4 == "SCHEMA"  && $5 == "-" && $6 == "public" { next }
  $4 == "COMMENT" && $5 == "-" && $6 == "SCHEMA" && $7 == "public" { next }
  { print }
' "$TOC_RAW" > "$TOC_FILTERED"

FILTERED_TABLE_COUNT=$(count_table_entries "$TOC_FILTERED")
if [[ "$FILTERED_TABLE_COUNT" -ne "$EXPECTED_TABLE_COUNT" ]]; then
  die "Filtered TOC table count changed; refusing to restore." 1
fi
for required_table in _prisma_migrations _prisma_migrations_backup_20260920; do
  if ! has_table_entry "$TOC_FILTERED" "$required_table"; then
    die "Filtered TOC dropped required table '$required_table'; refusing to restore." 1
  fi
done
if has_public_schema_entry "$TOC_FILTERED"; then
  die "Filtered TOC still contains SCHEMA - public; refusing to restore." 1
fi
if has_public_schema_comment "$TOC_FILTERED"; then
  die "Filtered TOC still contains COMMENT - SCHEMA public; refusing to restore." 1
fi
pass "Filtered TOC preserves all $FILTERED_TABLE_COUNT tables and removes the public schema entries."
assert_toc_has_no_unexpected_kinds "$TOC_FILTERED"

# ---------------------------------------------------------------------------
# Execute — step 4: extensions
# ---------------------------------------------------------------------------
info "Step 4/6: creating required extensions on the target ..."
# pg_dump --schema=public omits EXTENSION entries from the archive. Because the
# extensions are absent from the TOC, pg_restore --clean will NOT drop them.
# pg_stat_statements is intentionally not created.
if ! "$PSQL_BIN" -X "$CLEAN_TARGET" -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;' \
  -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'; then
  die "Failed to create required extensions on the target; restore not started." 1
fi
pass "Extensions ready: pg_trgm, pgcrypto."

# ---------------------------------------------------------------------------
# Execute — step 5: restore
# ---------------------------------------------------------------------------
info "Step 5/6: restoring into the Neon target ..."
# No -j: a single transaction is required so any failure rolls the restore back.
if ! "$PG_RESTORE_BIN" \
  --dbname="$CLEAN_TARGET" \
  --use-list="$TOC_FILTERED" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --single-transaction \
  --exit-on-error \
  "$DUMP"; then
  fail "pg_restore failed. The restore was single-transaction, so its changes should have rolled back; the pre-created extensions remain."
  exit 1
fi
pass "Restore completed."

info "Comparing source and target manifests ..."
capture_table_manifest "$CLEAN_TARGET" "$MANIFEST_TARGET_TABLES"
capture_object_manifest "$CLEAN_TARGET" "$MANIFEST_TARGET_OBJECTS"
capture_ledger_manifest "$CLEAN_TARGET" "$MANIFEST_TARGET_LEDGER"
assert_manifest_match "tables" "$MANIFEST_SOURCE_TABLES" "$MANIFEST_TARGET_TABLES"
assert_manifest_match "objects" "$MANIFEST_SOURCE_OBJECTS" "$MANIFEST_TARGET_OBJECTS"
assert_manifest_match "prisma-ledger" "$MANIFEST_SOURCE_LEDGER" "$MANIFEST_TARGET_LEDGER"

# ---------------------------------------------------------------------------
# Execute — step 6: verification
# ---------------------------------------------------------------------------
info "Step 6/6: running read-only verification SQL ..."
if ! "$PSQL_BIN" -X "$CLEAN_TARGET" -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"; then
  fail "Post-restore verification FAILED. The restore is committed, but the data is not verified; do NOT cut over."
  exit 1
fi
pass "Migration verification passed."

PRISMA_STATUS="skipped (--check-prisma not set)"
if $CHECK_PRISMA; then
  info "Applying pending Prisma migrations to the target (explicitly requested) ..."
  validate_target_team_owner_uniqueness
  if [[ -x "$REPO_ROOT/node_modules/.bin/prisma" ]]; then
    PRISMA_CMD=("$REPO_ROOT/node_modules/.bin/prisma")
  elif command -v npx >/dev/null 2>&1; then
    PRISMA_CMD=(npx prisma)
  else
    die "--check-prisma requested, but neither node_modules/.bin/prisma nor npx is available." 1
  fi

  if ! (cd "$REPO_ROOT" && DATABASE_URL="$CLEAN_TARGET" DIRECT_URL="$CLEAN_TARGET" "${PRISMA_CMD[@]}" migrate deploy); then
    fail "prisma migrate deploy failed. Restore and verification passed, but do NOT cut over until this is understood."
    exit 1
  fi
  if ! "$PSQL_BIN" -X "$CLEAN_TARGET" -v ON_ERROR_STOP=1 -tA -c "
    SELECT CASE WHEN
      (SELECT count(*) FROM public._prisma_migrations
       WHERE migration_name = '20261023000000_add_neon_extensions'
         AND finished_at IS NOT NULL AND rolled_back_at IS NULL) = 1
      AND (SELECT count(*) FROM public._prisma_migrations
           WHERE finished_at IS NULL AND rolled_back_at IS NULL) = 0
    THEN 'ok' ELSE 'bad' END;
  " | grep -qx 'ok'; then
    fail "Prisma ledger verification failed after migrate deploy. Do NOT cut over."
    exit 1
  fi
  PRISMA_STATUS="PASS (migrate deploy + ledger verified)"
fi

ROW_SUMMARY=$(
  "$PSQL_BIN" -X "$CLEAN_TARGET" -v ON_ERROR_STOP=1 -tA -c '
    SELECT format(
      $$User=%s Mod=%s Game=%s Series=%s Team=%s ModView=%s DownloadClick=%s Endorsement=%s ModComment=%s AuditLog=%s$$,
      (SELECT count(*) FROM public."User"),
      (SELECT count(*) FROM public."Mod"),
      (SELECT count(*) FROM public."Game"),
      (SELECT count(*) FROM public."Series"),
      (SELECT count(*) FROM public."Team"),
      (SELECT count(*) FROM public."ModView"),
      (SELECT count(*) FROM public."DownloadClick"),
      (SELECT count(*) FROM public."Endorsement"),
      (SELECT count(*) FROM public."ModComment"),
      (SELECT count(*) FROM public."AuditLog")
    );
  '
)

# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
echo
echo "=== Migration manifest ==="
printf 'dump:       %s\n' "$DUMP"
printf 'checksum:   %s\n' "$CHECKSUM"
printf 'sha256:     %s\n' "$SHA256"
printf 'size:       %s bytes\n' "$SIZE_BYTES"
printf 'tables:     %s (expected %s)\n' "$FILTERED_TABLE_COUNT" "$EXPECTED_TABLE_COUNT"
printf 'workdir:    %s\n' "$WORKDIR"
printf 'target:     (redacted)\n'
printf 'mode:       --clean (target public tables were replaced)\n'
printf 'verify:     PASS\n'
printf 'prisma:     %s\n' "$PRISMA_STATUS"
printf 'row counts: %s\n' "$ROW_SUMMARY"
echo
cat <<'EOF'
Next manual steps:
  1. Point the application's pooled DATABASE_URL at the Neon pooled endpoint and
     DIRECT_URL at this direct endpoint (outside this script).
  2. Run smoke tests: login, search, a mod page, a download, and admin read pages.
  3. Keep Aiven available and read-only during the soak period; do not
     decommission it until the Neon cutover is accepted.
  4. Take a Neon backup/snapshot before enabling writes.
  5. Keep the dump and checksum until cutover is complete.
  6. Do NOT run `prisma migrate dev` or `prisma db push` against the restored DB.
EOF
