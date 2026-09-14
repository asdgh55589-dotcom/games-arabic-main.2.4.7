#!/usr/bin/env bash
set -euo pipefail
echo "=== Preflight checks ==="
# 1. tsc
npx tsc --noEmit || { echo "FAIL: tsc"; exit 1; }
# 2. jest
npx jest --ci --silent || { echo "FAIL: jest"; exit 1; }
# 3. deploy.sh --env-check (if exists)
[ -f scripts/deploy.sh ] && bash scripts/deploy.sh --env-check || true
# 4. prisma validate
npx prisma validate || { echo "FAIL: prisma validate"; exit 1; }
# 5. Grep guards — forbidden strings must NOT appear
for term in "discord" "IaMultipart" "x-cron-secret" "yourdomain"; do
  if grep -r "$term" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules\|__tests__\|test\|spec" | grep -q .; then
    echo "FAIL: forbidden string '$term' found in src/"
    exit 1
  fi
done
echo "=== All preflight checks passed ==="
