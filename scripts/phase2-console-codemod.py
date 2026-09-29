#!/usr/bin/env python3
"""Phase 2 codemod: console.(log|info|warn|error|debug) -> logger.* in API routes.

Skips: __tests__ dirs, files with console.time/timeEnd/table/assert (timers
must keep working), files without remaining console.* calls.
Inserts `import { logger } from '@/lib/logger'` after the leading import block.
"""
import re
import sys
from pathlib import Path

API = Path('src/app/api')
SKIP_METHODS = ('time', 'timeEnd', 'table', 'assert', 'count', 'group', 'trace', 'dir')
REPLACEMENTS = [
    (re.compile(r'\bconsole\.error\('), 'logger.error('),
    (re.compile(r'\bconsole\.warn\('), 'logger.warn('),
    (re.compile(r'\bconsole\.log\('), 'logger.info('),
    (re.compile(r'\bconsole\.info\('), 'logger.info('),
    (re.compile(r'\bconsole\.debug\('), 'logger.debug('),
]
LOGGER_IMPORT = "import { logger } from '@/lib/logger'"
IMPORT_RE = re.compile(r"^\s*import[ (]")

changed_files = []
skipped_timer = []
for path in sorted(API.rglob('route.ts')):
    if '__tests__' in path.parts:
        continue
    text = path.read_text()
    if any(f'console.{m}' in text for m in SKIP_METHODS):
        skipped_timer.append(str(path))
        continue
    if not re.search(r'\bconsole\.(error|warn|log|info|debug)\(', text):
        continue
    new = text
    counts = 0
    for rx, sub in REPLACEMENTS:
        new, n = rx.subn(sub, new)
        counts += n
    if counts == 0:
        continue
    if "'@/lib/logger'" not in new and '"@/lib/logger"' not in new:
        lines = new.split('\n')
        insert_at = 0
        for i, line in enumerate(lines):
            if IMPORT_RE.match(line) or line.strip() == '' or line.strip().startswith('//'):
                if IMPORT_RE.match(line):
                    insert_at = i + 1
                continue
            break
        lines.insert(insert_at, LOGGER_IMPORT)
        new = '\n'.join(lines)
    path.write_text(new)
    changed_files.append((str(path), counts))

print(f'CHANGED: {len(changed_files)} files')
for f, c in changed_files:
    print(f'  {c:3d}  {f}')
print(f'SKIPPED (timers): {len(skipped_timer)} files')
for f in skipped_timer:
    print(f'  {f}')
