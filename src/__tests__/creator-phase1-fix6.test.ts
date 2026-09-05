/**
 * PART 2 Phase 1 — Fix 6 tests: rate limits on creator writes.
 * Uses the real in-memory limiter (no Redis in test env).
 */
jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), create: jest.fn() },
    modRequest: { create: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
  requireAuth: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { requireAuth, requireCreatorStudio } from '@/lib/auth';
import { POST as modCreatePOST } from '@/app/api/creator/mods/route';
import { POST as modRequestPOST } from '@/app/api/mod-requests/route';

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('Fix 6: POST /api/creator/mods limited to 5/hour', () => {
  it('6th rapid create returns Arabic 429', async () => {
    (requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: { id: 'creator-rl-1', role: 'creator' },
      error: null,
    });

    let lastStatus = 0;
    let lastJson: any = null;
    for (let i = 0; i < 6; i++) {
      const res: any = await modCreatePOST(post('http://localhost/api/creator/mods', {}));
      lastStatus = res.status;
      lastJson = await res.json();
    }

    expect(lastStatus).toBe(429);
    expect(JSON.stringify(lastJson)).toMatch(/عدد كبير من الطلبات/);
  });
});

describe('Fix 6: POST /api/mod-requests limited to 3/hour', () => {
  it('4th rapid request returns 429', async () => {
    (requireAuth as jest.Mock).mockResolvedValue({ id: 'user-rl-1', role: 'member' });

    let lastStatus = 0;
    for (let i = 0; i < 4; i++) {
      const res: any = await modRequestPOST(
        post('http://localhost/api/mod-requests', { gameName: 'G', platform: 'PC' }),
      );
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});

describe('Fix 6: comment reply already rate-limited (worker-owned, do not touch)', () => {
  it('documents existing limiter in public comments route', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const code = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/mods/[slug]/comments/route.ts'),
      'utf8',
    );
    expect(code).toMatch(/rateLimit/);
  });
});
