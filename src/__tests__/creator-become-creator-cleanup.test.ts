/**
 * Become-creator cleanup: the old /become-creator landing was removed.
 * Single entry flow: settings CTA (or any redirect) -> /become-creator/apply.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();

function grepSrc(pattern: RegExp): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        const code = fs.readFileSync(full, 'utf8');
        if (pattern.test(code)) hits.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'src'));
  return hits;
}

describe('Become-creator single-flow enforcement', () => {
  it('old landing page file is gone', () => {
    expect(fs.existsSync(path.join(root, 'src/app/become-creator/page.tsx'))).toBe(false);
  });

  it('application form page still exists', () => {
    expect(fs.existsSync(path.join(root, 'src/app/become-creator/apply/page.tsx'))).toBe(true);
  });

  it('no exact /become-creator links/redirects remain (only /apply)', () => {
    const hits = grepSrc(/become-creator['"`]/).filter(
      (f) => !f.includes('become-creator-cleanup'),
    );
    const nonApply = hits.filter((f) => {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      return /become-creator['"`]/.test(code);
    });
    expect(nonApply).toEqual([]);
  });

  it('next.config keeps a permanent redirect for old links', () => {
    const config = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    expect(config).toMatch(/source: '\/become-creator', destination: '\/become-creator\/apply'/);
  });

  it('settings CTA points at the application form', () => {
    const settings = fs.readFileSync(path.join(root, 'src/views/settings.tsx'), 'utf8');
    expect(settings).toMatch(/\/become-creator\/apply/);
  });
});
