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

/**
 * Pages/layout/auth gate through the central CREATOR_ROLES helper (GAM-6/E E1)
 * instead of inline arrays. The central constant must admit owner/management.
 */
function usesCentralGate(code: string): boolean {
  return /isCreatorRole\(session\.role\)|isCreatorRole\(user\.role\)/.test(code);
}

function centralRolesAdmitOwner(): void {
  const roles = src('src/lib/roles.ts');
  expect(roles).toMatch(/'owner'/);
  expect(roles).toMatch(/'moderator'/);
  expect(roles).toMatch(/'manager'/);
}

describe('Studio guards admit owner/management (not only creator/publisher)', () => {
  it.each(STUDIO_PAGES)('%s admits owner via the central gate', (p) => {
    const code = src(p);
    expect(usesCentralGate(code)).toBe(true);
  });

  it('central CREATOR_ROLES admits owner/management', () => {
    centralRolesAdmitOwner();
  });

  it('studio layout admits owner via the central gate', () => {
    expect(usesCentralGate(src('src/app/creator/(studio)/layout.tsx'))).toBe(true);
  });

  it('proxy /creator guards (page + api) admit owner', () => {
    const arrays = roleArraysWithCreator(src('src/proxy.ts'));
    // page guard + api guard
    expect(arrays.length).toBeGreaterThanOrEqual(2);
    for (const a of arrays) expect(a).toMatch(/'owner'/);
  });

  it('requireCreatorStudio admits owner via the central gate', () => {
    const code = src('src/lib/auth.ts');
    expect(code).toMatch(/isCreatorRole\(user\.role\)/);
    centralRolesAdmitOwner();
  });
});

describe('Navbar exposes /creator to management', () => {
  it('every literal /creator link is gated with a condition mentioning owner/admin', () => {
    const code = src('src/components/navbar.tsx');
    const href = 'href="/creator"';
    let idx = code.indexOf(href);
    // Zero literals is fine when links go through dashboardPathForRole (next test).
    while (idx !== -1) {
      const windowBefore = code.slice(Math.max(0, idx - 500), idx);
      expect(windowBefore).toMatch(/owner/);
      idx = code.indexOf(href, idx + href.length);
    }
  });

  it('role-based dashboard links go through dashboardPathForRole', () => {
    const code = src('src/components/navbar.tsx');
    expect(code).toMatch(/dashboardPathForRole/);
    // Both desktop and mobile menus render only when a dashboard path exists.
    const gated = code.match(/dashboardPathForRole\(currentUser\.role\) &&/g) || [];
    expect(gated.length).toBeGreaterThanOrEqual(2);
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
