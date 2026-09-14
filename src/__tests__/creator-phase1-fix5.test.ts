/**
 * PART 2 Phase 1 — Fix 5 tests (updated): creator pages admit creator..owner
 * (user decision: owner/management enter /creator alongside creators).
 * Only plain members are redirected to /become-creator/apply.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const PAGES = [
  'src/app/creator/(studio)/mods/page.tsx',
  'src/app/creator/(studio)/mods/new/page.tsx',
  'src/app/creator/(studio)/mods/[id]/edit/page.tsx',
  'src/app/creator/(studio)/stats/page.tsx',
  'src/app/creator/(studio)/comments/page.tsx',
  'src/app/creator/(studio)/requests/page.tsx',
  'src/app/creator/(studio)/settings/page.tsx',
];

describe('Fix 5: page guards admit creators + management (only members redirected)', () => {
  it.each(PAGES)('%s admits owner', (p) => {
    const code = src(p);
    expect(code).toMatch(/'creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'/);
  });

  it('home page relies on the studio layout gate (single source of truth)', () => {
    const layout = src('src/app/creator/(studio)/layout.tsx');
    expect(layout).toMatch(/CREATOR_ONLY = \['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'\]/);
    const home = src('src/app/creator/(studio)/page.tsx');
    expect(home).not.toMatch(/redirect\('\/become-creator\/apply'\)/);
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
