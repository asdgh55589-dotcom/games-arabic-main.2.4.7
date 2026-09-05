/**
 * STEP 3 — Scenarios 1,2,6,8,9,10,16,17,19
 * Tests POST/GET /api/mods/[slug]/comments with mocked Prisma + auth.
 * Audit only — documents current behavior, does not fix bugs.
 */
import { GET, POST } from '../route';

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
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

// Behaves like Prisma for the shapes this route uses: roots index scan,
// rows-by-id, and parentId-in level scans (anything else → full table).
function mockCommentTable(all: any[]) {
  mockedCommentFindMany.mockImplementation(async (args: any) => {
    const w: any = args?.where ?? {};
    if (w.id?.in) return all.filter((c) => w.id.in.includes(c.id));
    if (w.parentId && typeof w.parentId === 'object' && 'in' in w.parentId)
      return all.filter((c) => c.parentId && w.parentId.in.includes(c.parentId));
    if (w.parentId === null || w.parentId === undefined) return all.filter((c) => c.parentId == null);
    return all;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.mockResolvedValue(user);
  mockedMod.mockResolvedValue(modRow);
  mockedModUpdate.mockResolvedValue({});
  (db.modComment.count as jest.Mock).mockResolvedValue(0);
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
  it('creates reply with parentId + computed depth, no full-table scan', async () => {
    mockedCommentFind.mockResolvedValue({ id: 'p1', modId: 'mod-1', parentId: null, depth: 2, userId: 'u9' });
    mockedCommentCreate.mockResolvedValue({ id: 'c2', parentId: 'p1', depth: 3 });
    const res = await POST(
      req('http://x/api/mods/test-mod/comments', { text: 'رد', parentId: 'p1' }),
      { params: slugParams } as any,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.parentId).toBe('p1');
    expect(mockedCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ depth: 3 }) }),
    );
    // depth comes from the parent row — the full-table scan is gone
    expect(mockedCommentFindMany).not.toHaveBeenCalled();
  });
  it('reply to depth-5 parent → 422 (max depth via column)', async () => {
    mockedCommentFind.mockResolvedValue({ id: 'p5', modId: 'mod-1', parentId: 'p4', depth: 5, userId: 'u9' });
    const res = await POST(
      req('http://x/api/mods/test-mod/comments', { text: 'عميق', parentId: 'p5' }),
      { params: slugParams } as any,
    );
    expect(res.status).toBe(422);
    expect(mockedCommentCreate).not.toHaveBeenCalled();
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
    mockCommentTable(rows);
    (db.modComment.count as jest.Mock).mockResolvedValue(rows.length);
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
  it('FIXED: server paginates roots (default limit 20) + reports totals', async () => {
    const big = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      parentId: null,
      likes: 0,
      isPinned: false,
      createdAt: new Date(Date.now() - i * 1000),
      user: null,
    }));
    mockCommentTable(big);
    (db.modComment.count as jest.Mock).mockResolvedValue(100);
    const res = await GET(req('http://x/api/mods/test-mod/comments?sort=newest'), {
      params: slugParams,
    } as any);
    const body = await res.json();
    expect(body.data.comments.length).toBe(20); // page, not 100
    expect(body.data.total).toBe(100);
    expect(body.data.totalRoots).toBe(100);
    expect(body.data.nextCursor).toBeTruthy();
  });
  it('second page via cursor returns the next roots', async () => {
    const big = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      parentId: null,
      likes: 0,
      isPinned: false,
      createdAt: new Date(Date.now() - i * 1000),
      user: null,
    }));
    mockCommentTable(big);
    (db.modComment.count as jest.Mock).mockResolvedValue(30);
    const p1 = await (
      await GET(req('http://x/api/mods/test-mod/comments?sort=newest&limit=20'), {
        params: slugParams,
      } as any)
    ).json();
    expect(p1.data.comments.length).toBe(20);
    const cursor = p1.data.nextCursor;
    const p2 = await (
      await GET(req(`http://x/api/mods/test-mod/comments?sort=newest&limit=20&cursor=${cursor}`), {
        params: slugParams,
      } as any)
    ).json();
    expect(p2.data.comments.length).toBe(10);
    expect(p2.data.nextCursor).toBeNull();
    const ids1 = new Set(p1.data.comments.map((c: any) => c.id));
    for (const c of p2.data.comments) expect(ids1.has(c.id)).toBe(false);
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

describe('10. Depth Limit Enforcement (column-based)', () => {
  it('reply at depth 5 boundary accepted (new depth = 5)', async () => {
    mockedCommentFind.mockResolvedValue({ id: 'p4', modId: 'mod-1', parentId: 'p3', depth: 4, userId: 'u9' });
    mockedCommentCreate.mockResolvedValue({ id: 'c5', depth: 5 });
    const res = await POST(req('http://x/api/mods/test-mod/comments', { text: 'حدي', parentId: 'p4' }), {
      params: slugParams,
    } as any);
    expect(res.status).toBe(200);
    expect(mockedCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ depth: 5 }) }),
    );
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
