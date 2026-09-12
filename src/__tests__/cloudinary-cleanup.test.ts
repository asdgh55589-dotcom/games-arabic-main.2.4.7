/**
 * SA-3 cleanup contract (Phase 4 Task C — static assertions, no prod, no uploads).
 *
 * - Stale MODS→Cloudinary migration script is deleted (mods→FreeImage;
 *   Cloudinary EXCLUSIVELY user avatars/banners).
 * - .env.example CLOUDINARY block: contradiction resolved + fail-closed default.
 * - cloudinary.ts docblock: SA-2's file — SA-3 VERIFIES ONLY, never edits.
 * - Admin health page: real-probe badge متصل/غير مُكوَّن/غير متاح.
 * - image-upload.tsx owner-rule comment preserved byte-identical.
 *
 * NOTE on isCloudinaryEnabled: src/lib/cloudinary.ts (SA-2's rewrite target)
 * does not export isCloudinaryEnabled yet, so the fail-closed default is
 * asserted against the .env.example line value instead. SA-2's rewrite MUST
 * treat missing/non-"true" CLOUDINARY_ENABLED as disabled (fail-closed).
 */
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

function cloudinaryEnvBlock(): string {
  const env = read('.env.example');
  const start = env.indexOf('── Cloudinary');
  const end = env.indexOf('── Phase 2 uploads: FreeImage');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return env.slice(start, end);
}

describe('SA-3: stale mod-migration script is gone', () => {
  it('scripts/migrate-mod-images-to-cloudinary.ts is deleted', () => {
    expect(
      fs.existsSync(path.join(root, 'scripts/migrate-mod-images-to-cloudinary.ts')),
    ).toBe(false);
  });

  it('no references to the deleted script remain (docs/scripts/CI/src)', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|ts|md|ya?ml|json|sh)$/.test(entry.name)) {
          const code = fs.readFileSync(full, 'utf8');
          if (code.includes('migrate-mod-images-to-cloudinary'))
            hits.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    // Self-hit exclusion (repo convention): this contract file names the
    // deleted script to assert its absence — that is not a live reference.
    const live = hits.filter((f) => !f.includes('cloudinary-cleanup'));
    expect(live).toEqual([]);
  });
});

describe('SA-3: .env.example CLOUDINARY block (contradiction resolved, fail-closed)', () => {
  it('declares EXCLUSIVE avatar/banner scope with mods→FreeImage', () => {
    const block = cloudinaryEnvBlock();
    expect(block).toMatch(/EXCLUSIVELY/i);
    expect(block).toMatch(/avatar/i);
    expect(block).toMatch(/FreeImage/);
  });

  it('does not route mods to Cloudinary (no stale mods phrasing)', () => {
    const block = cloudinaryEnvBlock();
    expect(block).not.toMatch(/صور التعديلات/);
    expect(block).not.toMatch(/mod[^a-z]*images?[^a-z]*use[^a-z]*cloudinary/i);
    expect(block).not.toMatch(/cloudinary[^a-z]*mod[^a-z]*images/i);
  });

  it('uncomments the 3 credential keys with placeholders + fail-closed CLOUDINARY_ENABLED="false"', () => {
    const block = cloudinaryEnvBlock();
    expect(block).toMatch(/^CLOUDINARY_ENABLED="false"/m);
    expect(block).toMatch(/^CLOUDINARY_CLOUD_NAME=".+"/m);
    expect(block).toMatch(/^CLOUDINARY_API_KEY=".+"/m);
    expect(block).toMatch(/^CLOUDINARY_API_SECRET=".+"/m);
  });
});

describe('SA-2 cross-review: cloudinary.ts docblock routes mods AWAY from Cloudinary (VERIFY ONLY — SA-3 does not edit this file)', () => {
  it('docblock declares EXCLUSIVE avatar/banner scope with mods→FreeImage, NEVER this module', () => {
    const lib = read('src/lib/cloudinary.ts');
    expect(lib).toMatch(/EXCLUSIVELY/i);
    expect(lib).toMatch(/avatar/i);
    expect(lib).toMatch(/FreeImage/);
    expect(lib).toMatch(/NEVER/i);
  });

  it('any mention of the old mods phrasing survives ONLY as quoted history with an explicit resolution marker', () => {
    const lib = read('src/lib/cloudinary.ts');
    // SA-2 documents the fix as "resolves the old contradiction: the previous
    // comment claimed the opposite" — that historical quotation is legitimate.
    // A live routing claim (mods as THIS module's purpose) must not exist.
    expect(lib).toMatch(/resolves the old contradiction|previous comment claimed/i);
    expect(lib).not.toMatch(/مخصص لصور التعديلات فقط \(cover, banner, screenshots\)\s*$/m);
    expect(lib).not.toMatch(/الصور الشخصية\s*وخلفيات المستخدمين تبقى على Supabase Storage\.?\s*$/m);
  });

  it('SA-3 sentinel contract is honored: negative usage is treated as unavailable, never rendered', () => {
    const health = read('src/lib/image-health-check.ts');
    expect(health).toMatch(/usageRecord\.usage[\s\S]*?<\s*0/);
    expect(health).toMatch(/usageRecord\.percentUsed[\s\S]*?<\s*0/);
    expect(health).toMatch(/unavailable:\s*true/);
  });
});

describe('SA-3: admin health page badge (real probe)', () => {
  it('renders متصل/غير مُكوَّن/غير متاح badge strings', () => {
    const page = read('src/app/admin/images/health/page.tsx');
    expect(page).toMatch(/متصل/);
    expect(page).toMatch(/غير مُكوَّن/);
    expect(page).toMatch(/غير متاح/);
  });

  it('consumes the unavailable flag (no masked-zero messaging)', () => {
    const page = read('src/app/admin/images/health/page.tsx');
    expect(page).toMatch(/unavailable/);
    const lib = read('src/lib/image-health-check.ts');
    expect(lib).toMatch(/unavailable:\s*true/);
    expect(lib).not.toMatch(/تجاهل — سيظهر 0/);
  });
});

describe('SA-3: image-upload.tsx owner-rule comment preserved (untouched)', () => {
  it('keeps the FreeImage/Cloudinary routing comment byte-identical', () => {
    const code = read('src/components/admin/image-upload.tsx');
    expect(code).toContain(
      '// صور التعديلات → FreeImage relay (صور الغلاف، البانر، لقطات الشاشة).',
    );
    expect(code).toContain(
      '// Owner rule: Cloudinary حصراً لأفاتار/بانر المستخدم — صور التعديلات',
    );
    expect(code).toContain('// لا تمر بـ Cloudinary أبداً. باقي الصور → Supabase Storage.');
  });
});
