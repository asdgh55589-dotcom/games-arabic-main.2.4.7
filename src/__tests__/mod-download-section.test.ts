/**
 * download tab (Stremio style) — wiring tests.
 * Header exposes title + file count + views + downloads;
 * each card exposes a version badge + real per-file downloads
 * + size + date + download actions + copy-link.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

function section(): string {
  return fs.readFileSync(path.join(root, 'src/components/mod-download-section.tsx'), 'utf8')
}

function modApi(): string {
  return fs.readFileSync(path.join(root, 'src/app/api/mods/[slug]/route.ts'), 'utf8')
}

describe('download section (Stremio)', () => {
  it('header shows title + file count + views + downloads', () => {
    expect(section()).toMatch(/ملفات التحميل/)
    expect(section()).toMatch(/files\.length/)
    expect(section()).toMatch(/stats\.views/)
    expect(section()).toMatch(/stats\.downloads/)
  })

  it('each card shows version badge + per-file downloads + size + date', () => {
    expect(section()).toMatch(/v\{file\.version\}/)
    expect(section()).toMatch(/downloadsCount/)
    expect(section()).toMatch(/file\.fileSize/)
    expect(section()).toMatch(/releaseDate/)
  })

  it('exposes download actions + copy-link per file', () => {
    expect(section()).toMatch(/handleDownloadClick/)
    expect(section()).toMatch(/aria-label="نسخ رابط التحميل"/)
  })

  it('API aggregates real per-file download clicks', () => {
    expect(modApi()).toMatch(/downloadClick\.groupBy/)
    expect(modApi()).toMatch(/downloadsCount/)
  })
})
