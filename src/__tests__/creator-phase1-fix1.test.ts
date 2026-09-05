/**
 * PART 2 Phase 1 — Fix 1 regression tests (PUT→PATCH + redirects).
 * Static-source audit: creator mod-form must save via PATCH (the only
 * handler on /api/creator/mods/[id]) and stay inside /creator routes.
 */
import * as fs from 'fs';
import * as path from 'path';

const modFormSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/creator/mod-form.tsx'),
  'utf8',
);

describe('Fix 1: creator edit save uses PATCH (not PUT)', () => {
  it('edit branch sends PATCH', () => {
    expect(modFormSrc).toMatch(/const method = isEdit \? 'PATCH' : 'POST'/);
  });

  it('no PUT to creator mods endpoint', () => {
    expect(modFormSrc).not.toMatch(/method = isEdit \? 'PUT'/);
  });
});

describe('Fix 1: creator form never navigates to /admin/mods', () => {
  it('no router.push(/admin/mods)', () => {
    expect(modFormSrc).not.toMatch(/router\.push\('\/admin\/mods'\)/);
  });

  it('no Link href=/admin/mods', () => {
    expect(modFormSrc).not.toMatch(/href="\/admin\/mods"/);
  });

  it('post-save lands on /creator/mods', () => {
    expect(modFormSrc).toMatch(/router\.push\('\/creator\/mods'\)/);
  });
});
