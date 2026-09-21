import { ALL_DOCS, getDocPage } from '@/lib/docs/mod-form-docs'

const PLATFORM_IDS = ['pc', 'ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'switch', 'xbox360', 'android']

// Shared model: platform-select + head (title → method) + specific + tail (summary → save)
const SHARED_HEAD = ['title', 'arabic-title', 'scope', 'mod-type', 'mod-method']
const SHARED_TAIL = [
  'summary',
  'description',
  'source',
  'install',
  'changelog-field',
  'tags',
  'images',
  'videos',
  'file-meta',
  'download-files',
  'schedule',
  'relations',
  'team-assign',
  'team-members',
  'contacts-tabs',
  'save',
]

const SPECIFIC: Record<string, string[]> = {
  pc: ['compat'],
  ps1: ['gameId'],
  ps2: ['gameId'],
  ps3: ['gameId', 'updateNumber'],
  ps4: ['cusa', 'systemVersion', 'updateNumber'],
  ps5: ['ppsa', 'systemVersion', 'updateNumber'],
  switch: ['titleId', 'device', 'updateNumber'],
  xbox360: ['titleId', 'mediaId', 'formats'],
  android: ['installType', 'cpuArch', 'gameVersion', 'minAndroid'],
}

describe('mod-form docs structure (intro + per-platform pages)', () => {
  it('has 12 pages: intro + 9 platforms + moderator + team', () => {
    expect(ALL_DOCS.map((p) => p.id)).toEqual([
      'intro',
      ...PLATFORM_IDS,
      'moderator',
      'team',
    ])
  })

  it('every platform page follows the full model in order', () => {
    for (const id of PLATFORM_IDS) {
      const page = getDocPage(id)!
      expect(page.sections.map((s) => s.id)).toEqual([
        'platform-select',
        ...SHARED_HEAD,
        ...SPECIFIC[id],
        ...SHARED_TAIL,
      ])
    }
  })

  it('every platform page: good + bad boxes (bad lines carry reasons) + comparison tables', () => {
    for (const id of PLATFORM_IDS) {
      const page = getDocPage(id)!
      const blocks = page.sections.flatMap((s) => s.children)
      const good = blocks.filter((b) => b.type === 'good')
      const bad = blocks.filter((b) => b.type === 'bad')
      expect(good.length).toBeGreaterThanOrEqual(10)
      expect(bad.length).toBeGreaterThanOrEqual(10)
      for (const b of bad) {
        expect(b.text).toMatch(/\(.+\)/)
      }
      const tables = blocks.filter((b) => b.type === 'table')
      expect(tables.length).toBeGreaterThanOrEqual(8)
      for (const t of tables) {
        expect(t.headers!.length).toBeGreaterThanOrEqual(2)
        expect(t.rows!.length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('moderator + team pages are untouched', () => {
    expect(getDocPage('moderator')?.sections.map((s) => s.id)).toEqual([
      'accept', 'reject', 'quality', 'field-check',
    ])
    expect(getDocPage('team')?.sections.length).toBeGreaterThan(0)
  })
})
