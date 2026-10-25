import { stripModRelations } from '@/lib/mod-relations'

describe('stripModRelations — siteLinks', () => {
  it('removes siteLinks from scalar payload', () => {
    const out = stripModRelations({ name: 'x', siteLinks: [{ url: 'https://example.com' }] } as any)
    expect(out).toEqual({ name: 'x' })
    expect('siteLinks' in out).toBe(false)
  })

  it('removes siteLinks even when empty array', () => {
    const out = stripModRelations({ name: 'x', siteLinks: [] } as any)
    expect(out).toEqual({ name: 'x' })
    expect('siteLinks' in out).toBe(false)
  })

  it('removes all relation keys including siteLinks', () => {
    const out = stripModRelations({
      name: 'x',
      files: [],
      videoGroups: [],
      teamMembers: [],
      contactLinks: [],
      customTabs: [],
      siteLinks: [],
    } as any)
    expect(out).toEqual({ name: 'x' })
  })
})
