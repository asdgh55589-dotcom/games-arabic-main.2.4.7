import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const ui = fs.readFileSync(path.join(root, 'src/components/creator/reports-client.tsx'), 'utf8')
const appealRoute = fs.readFileSync(path.join(root, 'src/app/api/creator/reports/[id]/appeal/route.ts'), 'utf8')

describe('report appeal UI', () => {
  it('has appeal button for rejected reports', () => {
    expect(ui).toContain('استئناف')
    expect(ui).toMatch(/isRejected/)
  })

  it('has appeal form with reason textarea and optional evidence url', () => {
    expect(ui).toContain('Textarea')
    expect(ui).toContain('appealReason')
    expect(ui).toContain('appealEvidence')
    expect(ui).toMatch(/evidenceUrl/)
  })

  it('displays appeal status pending/appealed/upheld', () => {
    expect(ui).toContain('pending')
    expect(ui).toContain('appealed')
    expect(ui).toContain('upheld')
  })

  it('shows appeal history in report detail', () => {
    expect(ui).toMatch(/appeal history/)
  })

  it('appeal route notifies admins and includes report id + link', () => {
    expect(appealRoute).toMatch(/role: { in: \['admin', 'manager', 'owner'\] }/)
    expect(appealRoute).toContain('sendAdminAlert')
    expect(appealRoute).toContain('report.id')
    expect(appealRoute).toMatch(/\/admin\/reports\//)
  })

  it('appeal route accepts optional evidenceUrl', () => {
    expect(appealRoute).toContain('evidenceUrl')
  })
})
