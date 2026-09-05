/**
 * PART 2 Phase 1 — Fix 5 tests: creator pages allow ONLY creator/publisher
 * (matches proxy + layout gate). No dead staff branches in creator APIs.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const PAGES = [
  'src/app/creator/(studio)/page.tsx',
  'src/app/creator/(studio)/mods/page.tsx',
  'src/app/creator/(studio)/mods/new/page.tsx',
  'src/app/creator/(studio)/mods/[id]/edit/page.tsx',
  'src/app/creator/(studio)/stats/page.tsx',
  'src/app/creator/(studio)/comments/page.tsx',
  'src/app/creator/(studio)/requests/page.tsx',
  'src/app/creator/(studio)/settings/page.tsx',
];

describe('Fix 5: page guards narrowed to creator/publisher', () => {
  it.each(PAGES)('%s allows exactly creator+publisher', (p) => {
    const code = src(p);
    // broadened 6-role list must be gone
    expect(code).not.toMatch(/'moderator', 'admin', 'manager', 'owner'/);
    expect(code).toMatch(/'creator', 'publisher'/);
  });
});

describe('Fix 5: no dead isAdmin bypass in creator mods APIs', () => {
  it('mods/[id] route has no isAdmin branch', () => {
    const code = src('src/app/api/creator/mods/[id]/route.ts');
    expect(code).not.toMatch(/isAdmin/);
  });

  it('mods/[id]/actions route has no staff bypass', () => {
    const code = src('src/app/api/creator/mods/[id]/actions/route.ts');
    expect(code).not.toMatch(/isAdmin/);
    expect(code).not.toMatch(/\['admin', 'manager', 'owner'\]\.includes\(user\.role\)/);
  });
});
