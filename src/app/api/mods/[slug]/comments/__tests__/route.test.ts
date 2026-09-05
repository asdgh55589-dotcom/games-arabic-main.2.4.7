/**
 * STEP 3 — Scenarios 1,2,6,8,9,10,16,17,19
 * Tests POST/GET /api/mods/[slug]/comments with mocked Prisma + auth.
 * Audit only — documents current behavior, does not fix bugs.
 */
import { GET, POST } from '../route';

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}));

jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}));

import { getOptionalSession } from '@/lib/auth';
import { db } from '@/lib/db';

const mockedSession = getOptionalSession as jest.Mock;
const mockedMod = db.mod.findUnique as jest.Mock;
const mockedCommentFind = db.modComment.findUnique as jest.Mock;
const mockedCommentFindMany = db.modComment.findMany as jest.Mock;
const mockedCommentCreate = db.modComment.create as jest.Mock;
const mockedModUpdate = db.mod.update as jest.Mock;

const user = { id: 'user-1', username: 'أحمد', role: 'member' } as any;
const modRow = { id: 'mod-1', name: 'تعريب لعبة', authorId: 'author-1' };

function req(url: string, body?: unknown) {
  return {
    url,
    json: async () => body ?? {},
  } as any;
}
const slugParams = Promise.resolve({ slug: 'test-mod' });

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.mockResolvedValue(user);
  mockedMod.mockResolvedValue(modRow);
  mockedModUpdate.mockResolvedValue({});
});

describe('1. Basic Comment Creation', () => {
  it('creates comment, increments Mod.comments (happy path)', async () => {
    mockedCommentCreate.mockResolvedValue({ id: 'c1', text: 'تعليق تجريبي' });
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'تعليق تجريبي' }), {
      params: slugParams,
    } as any);
    const body = await res.json();
    expect(res.status).toBe(200); // ok() envelope, not 201 — documents actual behavior
    expect(body.data?.id).toBe('c1');
    expect(mockedCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: 'تعليق تجريبي' }) }),
    );
    expect(mockedModUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comments: { increment: 1 } } }),
    );
  });
});

describe('2. Reply to Comment', () => {
  it('creates reply with parentId when depth < 5', async () => {
    mockedCommentFind.mockResolvedValue({ id: 'p1', modId: 'mod-1', parentId: null });
    mockedCommentFindMany.mockResolvedValue([{ id: 'p1', parentId: null }]);
    mockedCommentCreate.mockResolvedValue({ id: 'c2', parentId: 'p1' });
    const res = await POST(
      req('http://x/api/mods/test-mod/comments', { text: 'رد', parentId: 'p1' }),
      { params: slugParams } as any,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.parentId).toBe('p1');
  });
});

describe('6. Sort & Pagination', () => {
  const rows = [
    { id: 'a', parentId: null, likes: 1, isPinned: false, createdAt: new Date('2024-01-01'), user: null },
    { id: 'b', parentId: null, likes: 99, isPinned: false, createdAt: new Date('2024-06-01'), user: null },
    { id: 'p', parentId: null, likes: 0, isPinned: true, createdAt: new Date('2023-01-01'), user: null },
  ];
  beforeEach(() => {
    mockedMod.mockResolvedValue({ id: 'mod-1' });
    mockedCommentFindMany.mockResolvedValue(rows);
  });
  it('popular sort orders by likes DESC with pinned first', async () => {
    const res = await GET(req('http://x/api/mods/test-mod/comments?sort=popular'), {
      params: slugParams,
    } as any);
    const body = await res.json();
    const ids = body.data.comments.map((c: any) => c.id);
    expect(ids[0]).toBe('p'); // pinned first
    expect(ids.slice(1)).toEqual(['b', 'a']);
  });
  it('BUG: server returns ALL rows (no server pagination)', async () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      parentId: null,
      likes: 0,
      isPinned: false,
      createdAt: new Date(),
      user: null,
    }));
    mockedCommentFindMany.mockResolvedValue(big);
    const res = await GET(req('http://x/api/mods/test-mod/comments?sort=newest'), {
      params: slugParams,
    } as any);
    const body = await res.json();
    // Documents bug from Step 2: expected 20 (PAGE_SIZE), actual 1000
    expect(body.data.comments.length).toBe(1000);
    expect(body.data.total).toBe(1000);
  });
});

describe('8. Minimum Length Validation', () => {
  it('single char "a" is ACCEPTED (min length is 1 after trim — intended)', async () => {
    mockedCommentCreate.mockResolvedValue({ id: 'c-min', text: 'a' });
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'a' }), {
      params: slugParams,
    } as any);
    expect(res.status).toBe(200);
    expect(mockedCommentCreate).toHaveBeenCalled();
  });
  it('FIXED: whitespace-only text rejected with Arabic 422', async () => {
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: '   ' }), {
      params: slugParams,
    } as any);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/فارغ/);
    expect(mockedCommentCreate).not.toHaveBeenCalled();
  });
});

describe('9. Maximum Length Validation', () => {
  it('2001 chars rejected with 422', async () => {
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'a'.repeat(2001) }), {
      params: slugParams,
    } as any);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/طويل|2000/);
    expect(mockedCommentCreate).not.toHaveBeenCalled();
  });
  it('2000 chars accepted (boundary)', async () => {
    mockedCommentCreate.mockResolvedValue({ id: 'c-max' });
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'a'.repeat(2000) }), {
      params: slugParams,
    } as any);
    expect(res.status).toBe(200);
  });
});

describe('10. Depth Limit Enforcement', () => {
  it('reply beyond 5 levels rejected with 422', async () => {
    // chain: p5 -> p4 -> p3 -> p2 -> p1 -> root (depth would exceed 5)
    const chain = [
      { id: 'p5', parentId: 'p4' },
      { id: 'p4', parentId: 'p3' },
      { id: 'p3', parentId: 'p2' },
      { id: 'p2', parentId: 'p1' },
      { id: 'p1', parentId: 'root' },
      { id: 'root', parentId: null },
    ];
    mockedCommentFind.mockResolvedValue({ id: 'p5', modId: 'mod-1', parentId: 'p4' });
    mockedCommentFindMany.mockResolvedValue(chain);
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'عميق', parentId: 'p5' }), {
      params: slugParams,
    } as any);
    expect(res.status).toBe(422);
    expect(mockedCommentCreate).not.toHaveBeenCalled();
  });
});

describe('16. isHidden Leak (FIXED in STEP 8 Phase 1)', () => {
  it('hidden comments are NOT served publicly', async () => {
    mockedMod.mockResolvedValue({ id: 'mod-1' });
    mockedCommentFindMany.mockResolvedValue([
      { id: 'vis', parentId: null, likes: 0, isPinned: false, isHidden: false, createdAt: new Date(), user: null },
      { id: 'hid', parentId: null, likes: 0, isPinned: false, isHidden: true, createdAt: new Date(), user: null },
    ]);
    const res = await GET(req('http://x/api/mods/test-mod/comments'), { params: slugParams } as any);
    const body = await res.json();
    const ids = body.data.comments.map((c: any) => c.id);
    expect(ids).toContain('vis');
    // NOTE: mocked findMany ignores `where`; the regression proof is the
    // `where: { modId, isHidden: false }` assertion below (real Prisma enforces it)
    expect(db.modComment.findMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isHidden: false }) }),
    );
  });
});

describe('19. Guest Commenting (dead feature)', () => {  it('unauthenticated POST with guestName returns 401 (feature not implemented)', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await POST(
      req('http://x/api/mods/test-mod/comments', { text: 'hi', guestName: 'زائر' }),
      { params: slugParams } as any,
    );
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error?.code).toBe('UNAUTHORIZED');
    expect(mockedCommentCreate).not.toHaveBeenCalled();
  });
});

describe('Rate limit on create (STEP 8 Phase 1)', () => {
  it('6th comment within 60s → 429 RATE_LIMITED with Arabic message, nothing created', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    (rateLimit as jest.Mock).mockResolvedValueOnce({ success: false, remaining: 0, resetAt: 0, limit: 5 });
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'spam' }), {
      params: slugParams,
    } as any);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error?.code).toBe('RATE_LIMITED');
    expect(JSON.stringify(body)).toMatch(/انتظر/);
    expect(mockedCommentCreate).not.toHaveBeenCalled();
  });
});
