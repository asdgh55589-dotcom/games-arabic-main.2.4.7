/**
 * STEP 4 — §3 Security attacks + §4.1 message audit (mocked handlers + sanitizer units).
 * Audit only: triggers real attack strings through real code paths.
 */
import * as fs from 'fs';
import * as path from 'path';
import { POST as modsPOST } from '@/app/api/mods/[slug]/comments/route';
import { GET as adminGET } from '@/app/api/admin/comments/route';
import { sanitizeHTML, sanitizeUrl } from '@/lib/sanitize';

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
  requireModerator: jest.fn(),
}));

jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}));

// sanitize-html ships ESM (htmlparser2) that ts-jest/node cannot parse, so the
// runtime strip test below uses a documented minimal stand-in. The audit-relevant
// part — OUR allowlist config — is asserted separately via captured options.
jest.mock('sanitize-html', () => ({
  __esModule: true,
  default: jest.fn((html: string, _opts: any) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''),
  ),
}));

import { getOptionalSession, requireModerator } from '@/lib/auth';
import { db } from '@/lib/db';

const slugParams = { params: Promise.resolve({ slug: 'test-mod' }) } as any;
const req = (url = 'http://x/', body?: unknown) => ({ url, json: async () => body ?? {} }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  (getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1', username: 'مهاجم', role: 'member' });
  (db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', name: 'م', authorId: 'a1' });
});

describe('3.1.1/3.1.2 stored XSS: server accepts raw HTML (no stripping — defense is at render)', () => {
  it.each([
    `<script>alert('xss')</script>`,
    `<img src=x onerror=alert('xss')>`,
    `<svg onload=alert('xss')>`,
  ])('POST %j → 200, stored verbatim via Prisma (parameterized, not executed)', async (evil) => {
    (db.modComment.create as jest.Mock).mockResolvedValue({ id: 'cx', text: evil });
    const res = await modsPOST(req('http://x/', { text: evil }), slugParams);
    expect(res.status).toBe(200);
    expect(db.modComment.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: evil }) }),
    );
  });
  it('renderer never uses dangerouslySetInnerHTML (structural XSS block ✅)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/markdown-renderer.tsx'), 'utf8');
    expect(src).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
  it('renderer color pseudo-tag allowlists hex only (static)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/markdown-renderer.tsx'), 'utf8');
    expect(src).toMatch(/\^#\(\[0-9a-fA-F\]/);
    expect(src).toMatch(/#3b82f6/); // safe fallback
  });
});

describe('3.1.3 markdown link javascript: blocked by sanitizeUrl ✅', () => {
  it.each([
    [`javascript:alert('xss')`, null],
    ['JaVaScRiPt:alert(1)', null],
    ['data:text/html,<script>alert(1)</script>', null],
    ['vbscript:msgbox(1)', null],
    ['https://example.com/page', 'https://example.com/page'],
    ['mailto:a@b.com', 'mailto:a@b.com'],
    ['/mod/slug', '/mod/slug'],
    ['#comments', '#comments'],
  ])('sanitizeUrl(%j) → %j', (input, expected) => {
    expect(sanitizeUrl(input)).toBe(expected);
  });
});

describe('3.1.4 sanitizeHTML strips event handlers + scripts ✅', () => {
  it('removes onerror/script, keeps safe markup (mocked lib; config asserted below)', () => {
    const out = sanitizeHTML(`<p>hi</p><img src=x onerror=alert(1)><script>alert(2)</script>`);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/<script/i);
    expect(out).toMatch(/<p>hi<\/p>/);
  });
  it('our allowlist config excludes script + event-handler attributes', async () => {
    const sanitizeHtmlMock = (await import('sanitize-html')).default as unknown as jest.Mock;
    sanitizeHtmlMock.mockClear();
    sanitizeHTML('<p>x</p>');
    const opts = sanitizeHtmlMock.mock.calls[0][1];
    expect(opts.allowedTags).not.toContain('script');
    for (const attrs of Object.values(opts.allowedAttributes) as string[][]) {
      expect(attrs.every((a) => !a.startsWith('on'))).toBe(true);
    }
    expect(opts.allowedSchemes).not.toContain('javascript');
  });
});

describe('3.2.2 admin search injection treated as literal ✅', () => {
  it("search `' OR '1'='1` becomes Prisma contains-string, not SQL", async () => {
    (requireModerator as jest.Mock).mockResolvedValue({ id: 'm', role: 'moderator' });
    (db.modComment.findMany as jest.Mock).mockResolvedValue([]);
    (db.modComment.count as jest.Mock).mockResolvedValue(0);
    const evil = `' OR '1'='1`;
    const res = await adminGET(req(`http://x/api/admin/comments?search=${encodeURIComponent(evil)}`));
    expect(res.status).toBe(200);
    expect(db.modComment.findMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ text: { contains: evil, mode: 'insensitive' } }, { guestName: { contains: evil, mode: 'insensitive' } }] },
      }),
    );
  });
});

describe('3.3 CSRF: no token/origin check (relies on SameSite cookies) ⚠️', () => {
  it('state-changing POST succeeds with no Origin/Referer header', async () => {
    (db.modComment.create as jest.Mock).mockResolvedValue({ id: 'c-csrf' });
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/mods/[slug]/comments/route.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/csrf|CSRF|x-csrf|origin|referer/i);
    const res = await modsPOST(req('http://x/', { text: 'cross-site?' }), slugParams);
    expect(res.status).toBe(200); // no origin validation performed
  });
});

describe('3.4.1 huge payload: zod max(2000) rejects before DB ✅ (transport: Next default 1MB)', () => {
  it('10MB text → 422, never reaches Prisma', async () => {
    const res = await modsPOST(req('http://x/', { text: 'a'.repeat(10 * 1024 * 1024) }), slugParams);
    expect(res.status).toBe(422);
    expect(db.modComment.create as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('4.1 error-message language audit (static)', () => {
  const routesDir = path.join(process.cwd(), 'src/app/api');
  const read = (p: string) => fs.readFileSync(path.join(routesDir, p), 'utf8');
  it('public comment routes are fully Arabic ✅ (FIXED Phase 4)', () => {
    const mods = read('mods/[slug]/comments/route.ts');
    const cid = read('comments/[id]/route.ts');
    const reaction = read('comments/[id]/reaction/route.ts');
    expect(mods).toMatch(/التعريب غير موجود/);
    expect(mods).toMatch(/يجب تسجيل الدخول للتعليق/);
    expect(mods).toMatch(/فشل نشر التعليق/);
    expect(cid).toMatch(/التعليق غير موجود/);
    expect(cid).toMatch(/فشل تعديل التعليق/);
    expect(cid).toMatch(/فشل حذف التعليق/);
    expect(cid).toMatch(/ليس لديك صلاحية/);
    expect(reaction).toMatch(/التعليق غير موجود/);
    for (const src of [mods, cid, reaction]) {
      expect(src).not.toMatch(/Mod not found|Login required to comment|Failed to (create|update|delete) comment|Comment not found/);
    }
  });
  it('creator + admin routes are Arabic with real status codes ✅ (FIXED)', () => {
    const creator = read('creator/comments/[id]/route.ts');
    const admin = read('admin/comments/route.ts');
    expect(creator).toMatch(/التعليق غير موجود/);
    expect(admin).toMatch(/يجب تسجيل الدخول/);
    expect(admin).toMatch(/ليس لديك صلاحية/);
    expect(admin).not.toMatch(/Unauthorized or forbidden/);
  });
  it('error boundary fallback is English-only ❌', () => {
    const eb = fs.readFileSync(path.join(process.cwd(), 'src/components/error-boundary.tsx'), 'utf8');
    expect(eb).toMatch(/Something went wrong/);
    expect(eb).not.toMatch(/حدث خطأ|عذراً|حاول مجدداً/);
  });
  it('UI toasts are Arabic ✅', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'src/components/comments/use-comments.ts'), 'utf8');
    expect(ui).toMatch(/تم نشر التعليق/);
    expect(ui).toMatch(/سجّل الدخول/);
  });
});
