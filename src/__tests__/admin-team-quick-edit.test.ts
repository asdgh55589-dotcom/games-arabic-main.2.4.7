import * as fs from 'node:fs'
import * as path from 'node:path'

import { buildTeamQuickEditPayload } from '@/lib/teams/quick-edit'

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

const current = {
  name: 'Old Team',
  description: 'وصف قديم',
  logoUrl: 'https://cdn.example/old.png',
}

describe('buildTeamQuickEditPayload', () => {
  it('returns null when nothing changed', () => {
    expect(buildTeamQuickEditPayload(current, { ...current })).toBeNull()
  })

  it('sends only the name when only the name changed', () => {
    const payload = buildTeamQuickEditPayload(current, { ...current, name: 'New Team' })

    expect(payload).toEqual({ name: 'New Team' })
    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('logoUrl')
  })

  it('sends only the description when only the description changed', () => {
    const payload = buildTeamQuickEditPayload(current, { ...current, description: 'وصف جديد' })

    expect(payload).toEqual({ description: 'وصف جديد' })
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('logoUrl')
  })

  it('sends only the logo when only the logo changed', () => {
    const payload = buildTeamQuickEditPayload(current, {
      ...current,
      logoUrl: 'https://cdn.example/new.png',
    })

    expect(payload).toEqual({ logoUrl: 'https://cdn.example/new.png' })
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('description')
  })

  it('sends an empty string only when the user intentionally cleared a field', () => {
    const payload = buildTeamQuickEditPayload(current, {
      name: current.name,
      description: '',
      logoUrl: '',
    })

    expect(payload).toEqual({ description: '', logoUrl: '' })
  })

  it('never sends empty strings for unchanged description/logo during a name edit', () => {
    const payload = buildTeamQuickEditPayload(current, { ...current, name: 'Renamed' })

    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('logoUrl')
    expect(JSON.stringify(payload)).not.toContain('""')
  })

  it('treats whitespace-only name changes as unchanged', () => {
    expect(
      buildTeamQuickEditPayload(current, { ...current, name: `  ${current.name}  ` }),
    ).toBeNull()
  })
})

describe('TeamActions quick-edit wiring', () => {
  const src = read('src/components/admin/teams/TeamActions.tsx')

  it('initializes description and logo from the current team', () => {
    expect(src).toMatch(/useState\(team\.description \|\| ''\)/)
    expect(src).toMatch(/useState\(team\.logoUrl \|\| ''\)/)
  })

  it('builds a diff payload and skips the request when nothing changed', () => {
    expect(src).toMatch(/buildTeamQuickEditPayload/)
    expect(src).toMatch(/if \(!payload\)/)
    expect(src).toMatch(/لا توجد تغييرات/)
    expect(src).toMatch(/JSON\.stringify\(payload\)/)
  })

  it('declares description/logoUrl on TeamItem so callers can pass them', () => {
    expect(src).toMatch(/interface TeamItem[\s\S]*?description[\s\S]*?logoUrl/)
  })

  it('TeamCard forwards the description field to TeamActions', () => {
    const card = read('src/components/admin/teams/TeamCard.tsx')
    expect(card).toMatch(/description: string/)
    expect(card).toMatch(/TeamActions team=\{team as never\}/)
  })
})
