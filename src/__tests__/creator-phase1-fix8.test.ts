/**
 * PART 2 Phase 1 — Fix 8 tests: ban info + suspended page wiring.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest';

jest.mock('@/lib/db', () => ({
  db: {
    user: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';
import { getBanInfo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const mockDb = db as unknown as { user: { findFirst: jest.Mock } };
const mockCreateClient = createClient as jest.Mock;

function supabaseAs(sbUser: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: sbUser } }) },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getBanInfo', () => {
  it('returns ban details for permanently banned user', async () => {
    supabaseAs({ id: 'sb-1', email: 'b@example.com' });
    mockDb.user.findFirst.mockResolvedValue({
      username: 'banned-creator',
      banStatus: 'banned_perm',
      bannedUntil: null,
      banReason: 'مخالفة',
    });

    const info = await getBanInfo();

    expect(info).toMatchObject({
      banned: true,
      type: 'perm',
      reason: 'مخالفة',
      username: 'banned-creator',
    });
  });

  it('returns ban details with expiry for temp-banned user', async () => {
    const future = new Date(Date.now() + 86400000);
    supabaseAs({ id: 'sb-2', email: 't@example.com' });
    mockDb.user.findFirst.mockResolvedValue({
      username: 'temp-creator',
      banStatus: 'banned_temp',
      bannedUntil: future,
      banReason: null,
    });

    const info = await getBanInfo();

    expect(info).toMatchObject({ banned: true, type: 'temp' });
    expect(info?.expiresAt).toEqual(future);
  });

  it('returns null when temp ban expired', async () => {
    supabaseAs({ id: 'sb-3', email: 'e@example.com' });
    mockDb.user.findFirst.mockResolvedValue({
      username: 'ex-creator',
      banStatus: 'banned_temp',
      bannedUntil: new Date(Date.now() - 1000),
      banReason: null,
    });

    await expect(getBanInfo()).resolves.toBeNull();
  });

  it('returns null for active user', async () => {
    supabaseAs({ id: 'sb-4', email: 'a@example.com' });
    mockDb.user.findFirst.mockResolvedValue({
      username: 'ok-creator',
      banStatus: 'active',
      bannedUntil: null,
      banReason: null,
    });

    await expect(getBanInfo()).resolves.toBeNull();
  });

  it('returns null when logged out', async () => {
    supabaseAs(null);

    await expect(getBanInfo()).resolves.toBeNull();
    expect(mockDb.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('Fix 8: suspended page placement + layout wiring (static)', () => {
  const root = process.cwd();
  const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

  it('suspended page lives outside the (studio) gate', () => {
    expect(fs.existsSync(path.join(root, 'src/app/creator/suspended/page.tsx'))).toBe(true);
    expect(
      fs.existsSync(path.join(root, 'src/app/creator/(studio)/suspended/page.tsx')),
    ).toBe(false);
  });

  it('studio layout checks ban FIRST and redirects to /creator/suspended', () => {
    const layout = src('src/app/creator/(studio)/layout.tsx');
    expect(layout).toMatch(/getBanInfo/);
    expect(layout).toMatch(/redirect\('\/creator\/suspended'\)/);
    // ban check must precede the session null-check (getSession nulls banned users)
    expect(layout.indexOf('getBanInfo()')).toBeLessThan(layout.indexOf('getSession()'));
  });

  it('suspended page shows reason + expiry and links home', () => {
    const page = src('src/app/creator/suspended/page.tsx');
    expect(page).toMatch(/ban\.reason/);
    expect(page).toMatch(/ban\.expiresAt/);
    expect(page).toMatch(/bdi/);
  });
});
