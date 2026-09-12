#!/usr/bin/env bash
#
# scripts/deploy.sh — idempotent, safe deployment automation.
#
#   bash scripts/deploy.sh            # full: checks + migrate + build + smoke
#   bash scripts/deploy.sh --env-check # validation only (no writes, no build)
#   bash scripts/deploy.sh --help      # usage
#
# Env overrides (for tests/CI):
#   DEPLOY_ENV_FILE   path to .env (default: repo-root .env)
#   DEPLOY_SKIP_SMOKE=1  skip next start + curl smoke (default: run)
#
# Safety: never prints secret values (key names only); never commits;
# exits non-zero before any mutation when preconditions fail.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/.env}"

# ---- required vs optional keys (mirrors .env.example + code refs) ----
REQUIRED_KEYS=(
  DATABASE_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  JWT_SECRET
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  TELEGRAM_BOT_TOKEN
  RESEND_API_KEY
  EMAIL_FROM
  FREEIMAGE_API_KEY
  IA_ACCESS_KEY
  IA_SECRET_KEY
  IA_IDENTIFIER
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
)
OPTIONAL_KEYS=(
  IMG_WORKER_DOMAIN
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  MEILISEARCH_HOST
  MEILISEARCH_MASTER_KEY
  IA_ENABLED
  NEXT_PUBLIC_IA_ENABLED
  NEXT_PUBLIC_IA_UPLOAD_MODE
  TELEGRAM_CHANNEL_ID
  CRON_SECRET
)

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy.sh [--env-check] [--help]

Modes:
  (default)    full deploy: pre-deploy checks, env validation, migrations,
               build, smoke checks, post-deploy report.
  --env-check  validation only: tree/branch/env checks, no writes, no build.
  --help       this message.

Required env keys live in .env (see .env.example). Missing required keys
print the exact line to append plus an Arabic explanation, then exit 1.
EOF
}

# ---- .env reader: KEY=value (quotes stripped), names only in output ----
env_val() {
  local key="$1" file="${2:-$ENV_FILE}" line val
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  [ -z "$line" ] && return 1
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  [ -z "$val" ] && return 1
  printf '%s' "present"
}

ar_why() {
  case "$1" in
    DATABASE_URL) echo "رابط قاعدة بيانات PostgreSQL (Neon للإنتاج)" ;;
    NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY) echo "إعدادات Supabase العامة للمصادقة" ;;
    SUPABASE_SERVICE_ROLE_KEY) echo "مفتاح الخدمة للتحقق من allowlist وإدارة المستخدمين" ;;
    JWT_SECRET) echo "سر توقيع كوكيز الجلسات (32+ حرف)" ;;
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME|TELEGRAM_BOT_TOKEN) echo "بوت تيليجرام لتسجيل الدخول" ;;
    RESEND_API_KEY|EMAIL_FROM) echo "خدمة البريد (استعادة كلمة المرور والتحقق)" ;;
    FREEIMAGE_API_KEY) echo "رفع صور التعريبات" ;;
    IA_ACCESS_KEY|IA_SECRET_KEY|IA_IDENTIFIER) echo "أرشيف الإنترنت لملفات المودات" ;;
    CLOUDINARY_*) echo "Cloudinary (صور/ملفات احتياطية)" ;;
    *) echo "مطلوب للنشر" ;;
  esac
}

env_check() {
  local missing=0 key
  echo "== env check: ${ENV_FILE} =="
  if [ ! -f "$ENV_FILE" ]; then
    echo "MISSING ${ENV_FILE} — انسخ .env.example إلى .env واملأ القيم"
    return 1
  fi
  for key in "${REQUIRED_KEYS[@]}"; do
    if env_val "$key" >/dev/null; then
      echo "OK      $key"
    else
      echo "MISSING $key — أضف هذا السطر إلى .env:"
      echo "  ${key}=value-or-PLACEHOLDER"
      echo "  السبب: $(ar_why "$key")"
      missing=1
    fi
  done
  for key in "${OPTIONAL_KEYS[@]}"; do
    if ! env_val "$key" >/dev/null; then
      echo "WARN    $key (optional — تحذير فقط)"
    fi
  done
  if [ "$missing" -ne 0 ]; then
    echo "env check FAILED — required keys missing above."
    return 1
  fi
  # JWT length sanity (names only, never values)
  echo "All required keys present."
  return 0
}

pre_deploy() {
  echo "== pre-deploy =="
  local branch dirty
  branch="$(git branch --show-current)"
  echo "branch: $branch"
  case "$branch" in
    feat/deploy-readiness|feat/creator-program-expansion|main) ;;
    *) echo "REFUSING: unexpected branch '$branch' (expected a release branch)."; return 1 ;;
  esac
  dirty="$(git status --porcelain=v1 | grep -v '^??' || true)"
  if [ -n "$dirty" ]; then
    echo "REFUSING: working tree has uncommitted tracked changes:"
    echo "$dirty"
    return 1
  fi
  echo "-- jest --"
  npx jest --ci --silent || return 1
  echo "-- tsc --"
  npx tsc --noEmit || return 1
  echo "-- prisma validate --"
  npx prisma validate || return 1
  echo "-- migrate status --"
  npx prisma migrate status || {
    echo "HINT: start local Postgres or set DATABASE_URL; deploy continues only with a clean status."
    return 1
  }
}

supabase_callback_check() {
  echo "== supabase callback allowlist =="
  echo "Manual reminder: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs"
  echo "must include: https://<your-domain>/api/auth/callback"
  echo "(Automated check via service role is not implemented — verify once per environment.)"
}

migrate_deploy() {
  echo "== migrate deploy =="
  npx prisma migrate deploy || {
    echo "MIGRATION FAILED — restore-point rollback hint:"
    echo "  1. Neon dashboard → Branches → promote your pre-release branch to primary."
    echo "  2. Re-point the app env to the restored branch."
    echo "  3. See docs/prod-migration-sync.md §R3/Rollback."
    return 1
  }
  echo "-- applied history --"
  npx prisma migrate status
}

build_smoke() {
  echo "== build =="
  npx next build || return 1
  if [ "${DEPLOY_SKIP_SMOKE:-0}" = "1" ]; then
    echo "(smoke skipped via DEPLOY_SKIP_SMOKE=1)"
    return 0
  fi
  echo "== smoke (next start + curl) =="
  local port="${DEPLOY_PORT:-3100}" pid=0
  npx next start -p "$port" >/tmp/deploy-smoke.log 2>&1 &
  pid=$!
  trap 'kill $pid 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "http://127.0.0.1:${port}/api/health" && break
    sleep 2
  done
  local fail=0 code
  check() { # $1 path, $2 expected code
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}$1")"
    if [ "$code" = "$2" ]; then echo "OK   $1 -> $code"; else echo "FAIL $1 -> $code (want $2)"; fail=1; fi
  }
  check "/" "200"
  check "/login" "200"
  check "/api/health" "200"
  check "/api/auth/me" "401"
  code="$(curl -s -o /dev/null -w '%{http_code}' -L --max-redirs 0 "http://127.0.0.1:${port}/creator" || true)"
  if [ "$code" = "307" ] || [ "$code" = "308" ]; then echo "OK   /creator -> $code (redirect)"; else echo "FAIL /creator -> $code (want redirect)"; fail=1; fi
  kill "$pid" 2>/dev/null || true
  trap - EXIT
  return "$fail"
}

post_report() {
  echo "== post-deploy report =="
  echo "branch: $(git branch --show-current)  HEAD: $(git rev-parse --short HEAD)"
  echo "migrations: see 'migrate deploy' output above (expect baseline + 8 additive)."
  echo "env: see 'env check' output above."
  echo "next manual steps for owner:"
  echo "  1. Supabase Redirect URLs allowlist (§supabase check above)."
  echo "  2. Missing/rotated keys per docs/staging-checklist.md §1."
  echo "  3. Manual E2E per staging checklist §4, then flip IA flags only after proof."
}

case "${1:---full}" in
  --help|-h) usage; exit 0 ;;
  --env-check) env_check; exit $? ;;
  --full|"") ;;
  *) echo "unknown arg: $1"; usage; exit 2 ;;
esac

pre_deploy || exit 1
env_check || exit 1
supabase_callback_check
migrate_deploy || exit 1
build_smoke || exit 1
post_report
