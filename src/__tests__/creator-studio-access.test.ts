/**
 * Creator studio access: owner/management must be able to enter /creator
 * (user decision), and /api/creator-requests must heal OAuth sessions
 * (Supabase valid but role cookie missing/stale -> 401 Unauthorized).
 */
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const STUDIO_PAGES = [
  'src/app/creator/(studio)/mods/page.tsx',
  'src/app/creator/(studio)/mods/new/page.tsx',
  'src/app/creator/(studio)/mods/[id]/edit/page.tsx',
  'src/app/creator/(studio)/stats/page.tsx',
  'src/app/creator/(studio)/comments/page.tsx',
  'src/app/creator/(studio)/requests/page.tsx',
  'src/app/creator/(studio)/settings/page.tsx',
];

/** every role-array literal that mentions 'creator' must also admit management */
function roleArraysWithCreator(code: string): string[] {
  const out: string[] = [];
  const re = /\[[^\]]*'creator'[^\]]*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[0]);
  return out;
}

describe('Studio guards admit owner/management (not only creator/publisher)', () => {
  it.each(STUDIO_PAGES)('%s admits owner', (p) => {
    const arrays = roleArraysWithCreator(src(p));
    expect(arrays.length).toBeGreaterThan(0);
    for (const a of arrays) {
      expect(a).toMatch(/'owner'/);
      expect(a).toMatch(/'moderator'/);
    }
  });

  it('studio layout admits owner', () => {
    const arrays = roleArraysWithCreator(src('src/app/creator/(studio)/layout.tsx'));
    expect(arrays.length).toBeGreaterThan(0);
    for (const a of arrays) expect(a).toMatch(/'owner'/);
  });

  it('proxy /creator guards (page + api) admit owner', () => {
    const arrays = roleArraysWithCreator(src('src/proxy.ts'));
    // page guard + api guard
    expect(arrays.length).toBeGreaterThanOrEqual(2);
    for (const a of arrays) expect(a).toMatch(/'owner'/);
  });

  it('requireCreatorStudio admits owner', () => {
    const arrays = roleArraysWithCreator(src('src/lib/auth.ts'));
    expect(arrays.length).toBeGreaterThan(0);
    for (const a of arrays) expect(a).toMatch(/'owner'/);
  });
});

describe('Navbar exposes /creator to management', () => {
  it('every /creator link is gated with a condition mentioning owner/admin', () => {
    const code = src('src/components/navbar.tsx');
    const href = 'href="/creator"';
    let idx = code.indexOf(href);
    expect(idx).toBeGreaterThan(-1);
    while (idx !== -1) {
      const windowBefore = code.slice(Math.max(0, idx - 500), idx);
      expect(windowBefore).toMatch(/owner/);
      idx = code.indexOf(href, idx + href.length);
    }
  });
});

describe('creator-requests heals OAuth sessions', () => {
  it('route falls back to Supabase and reissues the role cookie', () => {
    const code = src('src/app/api/creator-requests/route.ts');
    expect(code).toMatch(/supabase/i);
    expect(code).toMatch(/setRoleCookie/);
  });

  it('proxy /api/creator guard does not swallow /api/creator-requests', () => {
    const code = src('src/proxy.ts');
    // segment-boundary match only — members must reach the request endpoint
    expect(code).toMatch(/pathname === '\/api\/creator' \|\| pathname\.startsWith\('\/api\/creator\/'\)/);
    expect(code).not.toMatch(/if \(pathname\.startsWith\('\/api\/creator'\)\)/);
  });
});
