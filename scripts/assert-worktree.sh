#!/usr/bin/env bash
# Guard: verify this shell is operating in the creator stream's worktree.
# RUN BEFORE every task and every git command. Exits non-zero on mismatch.
set -euo pipefail

EXPECTED_TOPLEVEL="/home/x/Desktop/games-arabic-main"
EXPECTED_BRANCH="feat/creator-program-expansion"

TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null || echo MISSING)"
BRANCH="$(git branch --show-current 2>/dev/null || echo MISSING)"

echo "toplevel: $TOPLEVEL"
echo "branch:   $BRANCH"

if [ "$TOPLEVEL" != "$EXPECTED_TOPLEVEL" ]; then
  echo "ABORT: wrong worktree (expected $EXPECTED_TOPLEVEL)" >&2
  exit 1
fi
if [ "$BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "ABORT: wrong branch (expected $EXPECTED_BRANCH)" >&2
  exit 1
fi
echo "worktree OK"
