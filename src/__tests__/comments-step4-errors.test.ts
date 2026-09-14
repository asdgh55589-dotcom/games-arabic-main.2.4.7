/**
 * STEP 4 — §1 User errors + §2 System errors + §4.2/4.3 (mocked handlers + static audits).
 * Audit only: asserts CURRENT behavior (including bugs), does not fix.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GET as modsGET, POST as modsPOST } from '@/app/api/mods/[slug]/comments/route';
import { DELETE as commentsDELETE, PATCH as commentsPATCH } from '@/app/api/comments/[id]/route';
import { POST as reactionPOST } from '@/app/api/comments/[id]/reaction/route';
import { GET as adminGET } from '@/app/api/admin/comments/route';

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
    commentLike: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), create: jest.fn() },
    // Mimic Prisma batch: observe ALL ops immediately (no unhandled rejections),
    // then rethrow the first rejection so routes see P2002 etc.
    $transaction: jest.fn(async (ops: any) => {
      const list = (Array.isArray(ops) ? ops : [ops]).map((op) => Promise.resolve(op));
      const settled = await Promise.allSettled(list);
      const rejected = settled.find((s) => s.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (rejected) throw rejected.reason;
      return ops;
    }),
  },
}));

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
  requireModerator: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true })),
}));

jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}));

import { getOptionalSession, requireModerator } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

// Prisma-batch mimic (also re-installed in beforeEach, since resetAllMocks
// wipes factory implementations): observe ALL ops so rejections surface to
// the route's try/catch instead of crashing the worker as unhandled.
async function mockTransaction(ops: any) {
  const list = (Array.isArray(ops) ? ops : [ops]).map((op) => Promise.resolve(op));
  const settled = await Promise.allSettled(list);
  const rejected = settled.find((s) => s.status === 'rejected') as
    | PromiseRejectedResult
    | undefined;
  if (rejected) throw rejected.reason;
  return ops;
}

const mockedSession = getOptionalSession as jest.Mock;
const mockedRateLimit = rateLimit as jest.Mock;
const user = { id: 'user-1', username: 'أحمد', role: 'member' } as any;
const slugParams = { params: Promise.resolve({ slug: 'test-mod' }) } as any;
const req = (url = 'http://x/', body?: unknown) => ({ url, json: async () => body ?? {} }) as any;

beforeEach(() => {
  // reset (not clear): drops per-test mockRejectedValue so rejected promises
  // can't leak into later tests' $transaction arrays as unhandled rejections.
  jest.resetAllMocks();
  (db.$transaction as jest.Mock).mockImplementation(mockTransaction);
  mockedSession.mockResolvedValue(user);
  mockedRateLimit.mockResolvedValue({ success: true });
  (requireModerator as jest.Mock).mockResolvedValue({ id: 'mod-1', role: 'moderator' });
  (db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', name: 'م', authorId: 'a1' });
});

describe('1.1.2 trimmed single char "   a   " is accepted (valid content)', () => {
  it('returns 200 — trim-then-validate would also accept, consistent', async () => {
    (db.modComment.create as jest.Mock).mockResolvedValue({ id: 'c1' });
    const res = await modsPOST(req('http://x/', { text: '   a   ' }), slugParams);
    expect(res.status).toBe(200);
  });
});

describe('1.1.3 max-length error message language (FIXED: Arabic)', () => {
  it('2001 chars → 422 with Arabic message', async () => {
    const res = await modsPOST(req('http://x/', { text: 'a'.repeat(2001) }), slugParams);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(JSON.stringify(body)).toMatch(/طويل|2000/);
  });
});

describe('1.1.4 invalid parentId → 404', () => {
  it('non-existent parent returns NOT_FOUND, nothing created', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await modsPOST(req('http://x/', { text: 'رد', parentId: 'ghost' }), slugParams);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
    expect(db.modComment.create as jest.Mock).not.toHaveBeenCalled();
  });
  it('parent from another mod → 404 (cross-mod reply blocked)', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'p', modId: 'other-mod', parentId: null });
    const res = await modsPOST(req('http://x/', { text: 'رد', parentId: 'p' }), slugParams);
    expect(res.status).toBe(404);
  });
});

describe('1.1.5 invalid mod slug → 404', () => {
  it('POST to unknown mod returns NOT_FOUND', async () => {
    (db.mod.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await modsPOST(req('http://x/', { text: 'hi' }), slugParams);
    expect(res.status).toBe(404);
  });
  it('GET unknown mod returns NOT_FOUND (English message)', async () => {
    (db.mod.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await modsGET(req('http://x/?sort=newest'), slugParams);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error?.message).toBe('التعريب غير موجود'); // ✅ Arabic (FIXED Phase 4)
  });
});

describe('1.2.4 permission matrix (public delete route)', () => {
  const commentRow = { id: 'c1', userId: 'owner-9', modId: 'mod-1' };
  beforeEach(() => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue(commentRow);
    (db.modComment.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', parentId: null }]);
  });
  it('owner deletes → 200', async () => {
    mockedSession.mockResolvedValue({ id: 'owner-9', role: 'member' });
    const res = await commentsDELETE(req(), { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(200);
  });
  it('moderator deletes → 200', async () => {
    mockedSession.mockResolvedValue({ id: 'x', role: 'moderator' });
    const res = await commentsDELETE(req(), { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(200);
  });
  it('manager deletes → 403 on PUBLIC route (but creator route allows admin|manager|owner) — inconsistent', async () => {
    mockedSession.mockResolvedValue({ id: 'x', role: 'manager' });
    const res = await commentsDELETE(req(), { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(403); // documents inconsistency vs creator route :23
  });
});

describe('1.3.1 like rate limit → 429', () => {
  it('rateLimited() when limiter fails', async () => {
    mockedRateLimit.mockResolvedValue({ success: false });
    const res = await reactionPOST(req('http://x/', { value: 'like' }), { params: Promise.resolve({ id: 'c1' }) } as any);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error?.code).toBe('RATE_LIMITED');
  });
});

describe('1.3.2 create rate limit present (FIXED: via COMMENTS_CONFIG)', () => {
  it('mods comments route rate-limits create from central config', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/mods/[slug]/comments/route.ts'), 'utf8');
    expect(src).toMatch(/rateLimit\(req, \{[\s\S]*?limit: COMMENTS_CONFIG\.createLimit/);
    expect(src).toMatch(/keyPrefix: COMMENTS_CONFIG\.createKeyPrefix/);
  });
  it('config values are 5/minute', async () => {
    const { COMMENTS_CONFIG } = await import('@/lib/comments-config');
    expect(COMMENTS_CONFIG.createLimit).toBe(5);
    expect(COMMENTS_CONFIG.createWindowSec).toBe(60);
  });
});

describe('2.1.1 DB connection failure → 500 (no 503/retry hint)', () => {
  it('POST create throw → 500 Failed to create comment', async () => {
    (db.modComment.create as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await modsPOST(req('http://x/', { text: 'hello' }), slugParams);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error?.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toMatch(/503|retry|إعادة|مؤقت/i);
  });
  it('PATCH update throw → 500', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1' });
    (db.modComment.update as jest.Mock).mockRejectedValue(new Error('timeout'));
    const res = await commentsPATCH(req('http://x/', { text: 'x' }), { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(500);
  });
});

describe('2.1.3 P2002 race on like → graceful 200 (already handled ✅)', () => {
  it('concurrent like create conflict returns current counters, not 500', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', likes: 6, dislikes: 0 });
    (db.commentLike.findUnique as jest.Mock).mockResolvedValue(null);
    (db.commentLike.create as jest.Mock).mockRejectedValue({ code: 'P2002' });
    const res = await reactionPOST(req('http://x/', { value: 'like' }), { params: Promise.resolve({ id: 'c1' }) } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.liked).toBe(true);
  });
});

describe('2.3.1 GET is wrapped in try/catch (FIXED: proper 500 envelope)', () => {
  it('db failure in public GET returns 500 INTERNAL_ERROR in Arabic', async () => {
    (db.modComment.findMany as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await modsGET(req('http://x/'), slugParams);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error?.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).toMatch(/فشل تحميل التعليقات/);
  });
});

describe('2.2.1/2.3.2 frontend resilience (FIXED: AbortController + toasts)', () => {
  const ui = fs.readFileSync(path.join(process.cwd(), 'src/components/comments/use-comments.ts'), 'utf8');
  it('comment fetches use AbortController with central timeout', () => {
    expect(ui).toMatch(/new AbortController\(\)/);
    expect(ui).toMatch(/controller\.abort\(\), COMMENTS_CONFIG\.fetchTimeoutMs/);
    expect(ui).toMatch(/signal: controller\.signal/);
  });
  it('no scoped ErrorBoundary around <ModComments> in views', () => {
    const desktop = fs.readFileSync(path.join(process.cwd(), 'src/views/mod-detail.tsx'), 'utf8');
    const mobile = fs.readFileSync(path.join(process.cwd(), 'src/views/mod-detail-mobile.tsx'), 'utf8');
    expect(desktop).not.toMatch(/<ErrorBoundary[^>]*>[\s\S]*<ModComments/);
    expect(mobile).not.toMatch(/<ErrorBoundary[^>]*>[\s\S]*<ModComments/);
  });
});

describe('3.2.1 SQLi text stored verbatim (Prisma parameterized ✅)', () => {
  it("injection string passes through as data, create called once", async () => {
    const evil = "'; DROP TABLE \"ModComment\"; --";
    (db.modComment.create as jest.Mock).mockResolvedValue({ id: 'c-evil', text: evil });
    const res = await modsPOST(req('http://x/', { text: evil }), slugParams);
    expect(res.status).toBe(200);
    expect(db.modComment.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: evil }) }),
    );
  });
});

describe('3.4.2 array-bomb parentId → 422', () => {
  it('parentId as array rejected by Zod (expects string)', async () => {
    const res = await modsPOST(req('http://x/', { text: 'hi', parentId: ['a', 'b'] }), slugParams);
    expect(res.status).toBe(422);
  });
});

describe('3.5.1 enumeration: missing vs deleted IDs indistinguishable ✅', () => {
  it('PATCH unknown id → 404 NOT_FOUND (generic)', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await commentsPATCH(req('http://x/', { text: 'x' }), { params: Promise.resolve({ id: 'nope' }) } as any);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
  });
});

describe('4.2.2 form state preserved on failure ✅', () => {
  it("setNewComment('') only runs after res.ok (static order check)", () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'src/components/comments/use-comments.ts'), 'utf8');
    const block = ui.slice(ui.indexOf('const onSubmitComment'), ui.indexOf('const onSubmitReply'));
    expect(block.indexOf("setNewComment('')") > block.indexOf('if (!res.ok)')).toBe(true);
  });
});

describe('4.3 silent catches inventory (FIXED in UI; manager deferred to Phase 4)', () => {
  it('mod-comments fetch surfaces toast instead of silent catch', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'src/components/comments/use-comments.ts'), 'utf8');
    expect(ui).not.toMatch(/catch \{\s*\/\/ silent/);
    expect(ui).toMatch(/تعذّر تحميل التعليقات/);
  });
  it('manager surfaces toasts on all failures (FIXED Phase 4)', () => {
    const mgr = fs.readFileSync(
      path.join(process.cwd(), 'src/components/creator/comments-manager.tsx'),
      'utf8',
    );
    expect(mgr).not.toMatch(/catch \{\}/);
    // Phase 1 i18n: toast copy lives in src/lib/studio-i18n/ar.ts, referenced by key.
    expect(mgr).toMatch(/t\.loadError|t\.connectionError|t\.sendConnectionError/);
    const arDict = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/studio-i18n/ar.ts'),
      'utf8',
    );
    expect(arDict).toMatch(/تعذّر تحميل التعليقات/);
    expect(arDict).toMatch(/حدث خطأ أثناء الاتصال/);
    expect(arDict).toMatch(/تعذّر إرسال الرد/);
  });
});
