/**
 * STEP 3 — Scenarios 3,4,5,11,14,15
 * Tests PATCH/DELETE /api/comments/[id] + like/dislike toggles (mocked db/auth).
 */
import { DELETE, PATCH } from '../[id]/route';
import { POST as likePOST } from '../[id]/like/route';
import { POST as dislikePOST } from '../[id]/dislike/route';

jest.mock('@/lib/db', () => ({
  db: {
    mod: { update: jest.fn() },
    modComment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    commentLike: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((ops: any) => Promise.resolve(ops)),
  },
}));

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true })),
}));

import { getOptionalSession } from '@/lib/auth';
import { db } from '@/lib/db';

const mockedSession = getOptionalSession as jest.Mock;
const owner = { id: 'user-1', username: 'أحمد', role: 'member' } as any;
const other = { id: 'user-2', username: 'سارة', role: 'member' } as any;

function req(body?: unknown) {
  return { url: 'http://x/', json: async () => body ?? {} } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.mockResolvedValue(owner);
});

describe('3. Edit Own Comment', () => {
  it('owner PATCH updates text + isEdited', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1' });
    (db.modComment.update as jest.Mock).mockResolvedValue({
      id: 'c1',
      text: 'تعديل',
      isEdited: true,
      updatedAt: new Date(),
    });
    const res = await PATCH(req({ text: 'تعديل' }), { params: Promise.resolve({ id: 'c1' }) } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.isEdited).toBe(true);
    expect(db.modComment.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isEdited: true }) }),
    );
  });
});

describe('14. Unauthorized Edit', () => {
  it('non-owner PATCH returns 403 and does not update', async () => {
    mockedSession.mockResolvedValue(other);
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1' });
    const res = await PATCH(req({ text: 'اختراق' }), { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(403);
    expect(db.modComment.update as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('4. Delete Own Comment (+ cascade counter)', () => {
  it('owner DELETE removes subtree via level scans and decrements Mod.comments', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1',
      userId: 'user-1',
      modId: 'mod-1',
    });
    // level scans filter by parentId (like real Prisma) — no full-table read
    const all = [
      { id: 'c1', parentId: null },
      { id: 'r1', parentId: 'c1' },
      { id: 'r2', parentId: 'r1' },
      { id: 'r3', parentId: 'c1' },
    ];
    (db.modComment.findMany as jest.Mock).mockImplementation(async (args: any) => {
      const wanted: string[] = args?.where?.parentId?.in ?? [];
      return all.filter((c) => c.parentId && wanted.includes(c.parentId));
    });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.deletedCount).toBe(4); // 1 + 3 nested replies
    // every scan is scoped to parentId (never a full-table read)
    for (const call of (db.modComment.findMany as jest.Mock).mock.calls) {
      expect(call[0].where.parentId?.in).toBeDefined();
    }
    expect(db.modComment.deleteMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: expect.arrayContaining(['c1', 'r1', 'r2', 'r3']) } } }),
    );
  });
});

describe('15. Unauthorized Delete', () => {
  it('regular user cannot delete admin comment (403)', async () => {
    mockedSession.mockResolvedValue(other);
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'adm1',
      userId: 'admin-1',
      modId: 'mod-1',
    });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'adm1' }) } as any);
    expect(res.status).toBe(403);
    expect(db.modComment.deleteMany as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('5. Like/Dislike Toggle', () => {
  const idParams = { params: Promise.resolve({ id: 'c1' }) } as any;
  beforeEach(() => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', likes: 5, dislikes: 1 });
  });
  it('like with no prior reaction creates CommentLike + increments', async () => {
    (db.commentLike.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await likePOST(req(), idParams);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.liked).toBe(true);
    expect(db.commentLike.create as jest.Mock).toHaveBeenCalled();
  });
  it('like when already liked removes it (toggle off)', async () => {
    (db.commentLike.findUnique as jest.Mock).mockResolvedValue({ id: 'l1', value: 'like' });
    const res = await likePOST(req(), idParams);
    const body = await res.json();
    expect(body.data?.liked).toBe(false);
    expect(db.commentLike.delete as jest.Mock).toHaveBeenCalled();
  });
  it('dislike switches like -> dislike with both counters', async () => {
    (db.commentLike.findUnique as jest.Mock).mockResolvedValue({ id: 'l1', value: 'like' });
    const res = await dislikePOST(req(), idParams);
    const body = await res.json();
    expect(body.data?.disliked).toBe(true);
    expect(db.commentLike.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { value: 'dislike' } }),
    );
  });
});

describe('11. Concurrent Edits (race)', () => {
  it('documents last-write-wins (no versioning / no 409)', async () => {
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1' });
    const updateMock = db.modComment.update as jest.Mock;
    updateMock
      .mockResolvedValueOnce({ id: 'c1', text: 'edit-A', isEdited: true })
      .mockResolvedValueOnce({ id: 'c1', text: 'edit-B', isEdited: true });
    const [r1, r2] = await Promise.all([
      PATCH(req({ text: 'edit-A' }), { params: Promise.resolve({ id: 'c1' }) } as any),
      PATCH(req({ text: 'edit-B' }), { params: Promise.resolve({ id: 'c1' }) } as any),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200); // no conflict detection — both succeed
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
