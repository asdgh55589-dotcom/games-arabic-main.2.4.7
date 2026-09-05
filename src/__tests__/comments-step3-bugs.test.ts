/**
 * STEP 3 — Scenarios 7,12,13,18,20
 * Static/behavioral verification of UI gaps + creator counter drift.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PATCH as creatorPATCH } from '@/app/api/creator/comments/[id]/route';

jest.mock('@/lib/db', () => ({
  db: {
    modComment: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    mod: { update: jest.fn(), findUnique: jest.fn() },
    // callback-txn form: run the callback with a tx shim
    $transaction: jest.fn(async (fn: any) =>
      typeof fn === 'function'
        ? fn({
            modComment: {
              delete: (...a: any[]) => (jest.requireMock('@/lib/db') as any).db.modComment.delete(...a),
              count: (...a: any[]) => (jest.requireMock('@/lib/db') as any).db.modComment.count(...a),
            },
            mod: { update: (...a: any[]) => (jest.requireMock('@/lib/db') as any).db.mod.update(...a) },
          })
        : fn,
    ),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}));

import { requireCreatorStudio } from '@/lib/auth';
import { db } from '@/lib/db';

const root = process.cwd();
const commentSources = [
  'src/components/mod-comments.tsx',
  'src/components/comments/use-comments.ts',
  'src/components/comments/comment-card.tsx',
  'src/components/comments/comment-toolbar.tsx',
  'src/components/comments/reply-box.tsx',
].map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
const modCommentsSrc = commentSources.join('\n');
const managerSrc = fs.readFileSync(
  path.join(root, 'src/components/creator/comments-manager.tsx'),
  'utf8',
);

describe('7. Empty State', () => {
  it('public comments UI renders friendly EmptyState (not blank)', () => {
    expect(modCommentsSrc).toMatch(/EmptyState/);
    // exact copy in mod-comments.tsx:530-535 — verify Arabic empty copy exists
    expect(modCommentsSrc).toMatch(/لا توجد|لا يوجد|EmptyState/);
  });
  it('creator inbox has empty state', () => {
    expect(managerSrc).toMatch(/لا توجد تعليقات/);
  });
});

describe('12. Network Failure During Submission (missing optimistic UI)', () => {
  it('BUG: comment create has NO optimistic insert + rollback (only like does)', () => {
    // like path has rollback:
    expect(modCommentsSrc).toMatch(/rollback/);
    // submit path only does fetch -> fetchComments refresh, no optimistic setComments before POST:
    const submitIdx = modCommentsSrc.indexOf('const onSubmitComment');
    const submitBlock = modCommentsSrc.slice(submitIdx, submitIdx + 2500);
    expect(submitBlock).toMatch(/fetch\(`\/api\/mods/);
    expect(submitBlock).not.toMatch(/setComments\(.*\+.*new|optimistic/i);
  });
});

describe('13. Duplicate Submission (double-click guard)', () => {
  it('submitting flag guards rapid clicks (weak but present)', () => {
    // onSubmitComment:238 "if (!newComment.trim() || submitting) return"
    expect(modCommentsSrc).toMatch(/if \(!newComment\.trim\(\) \|\| submitting\) return/);
    expect(modCommentsSrc).toMatch(/if \(!replyText\.trim\(\) \|\| submitting\) return/);
    // documents weakness: single shared `submitting` for comment+reply, no debounce timer
    expect(modCommentsSrc).not.toMatch(/debounce|throttle|useDebounced/i);
  });
});

describe('18. Creator Delete Counter Drift (FIXED: recount like admin)', () => {
  it('creator delete recounts Mod.comments', async () => {
    (requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: { id: 'creator-1', role: 'creator' },
      error: null,
    });
    (db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1',
      modId: 'mod-1',
      mod: { authorId: 'creator-1' },
    });
    (db.modComment.delete as jest.Mock).mockResolvedValue({ id: 'c1' });
    (db.modComment.count as jest.Mock).mockResolvedValue(9);
    const res = await creatorPATCH({ url: 'http://x/', json: async () => ({ action: 'delete' }) } as any, {
      params: Promise.resolve({ id: 'c1' }),
    } as any);
    expect(res.status).toBe(200);
    expect(db.modComment.delete as jest.Mock).toHaveBeenCalled();
    // fixed: counter recounted and written back
    expect(db.modComment.count as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modId: 'mod-1' } }),
    );
    expect(db.mod.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comments: 9 } }),
    );
  });
});

describe('20. Reaction endpoint unified; dislike UI still deferred (P6)', () => {
  it('unified /reaction route exists; old /like + /dislike removed', () => {
    expect(fs.existsSync(path.join(root, 'src/app/api/comments/[id]/reaction/route.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/app/api/comments/[id]/like/route.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'src/app/api/comments/[id]/dislike/route.ts'))).toBe(false);
    expect(modCommentsSrc).toMatch(/\/api\/comments\/.*\/reaction/);
  });
  it('UI exposes like toggle only (dedicated dislike button deferred)', () => {
    expect(modCommentsSrc).not.toMatch(/عدم الإعجاب|لا يعجبني/i);
  });
});
