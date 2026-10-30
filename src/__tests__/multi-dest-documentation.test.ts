/**
 * Multi-destination documentation validation.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const docPath = path.join(root, 'docs/media-management/MULTI-DEST-FLOW.md')
const readmePath = path.join(root, 'docs/media-management/README.md')

describe('Multi-destination documentation', () => {
  it('MULTI-DEST-FLOW.md exists', () => {
    expect(fs.existsSync(docPath)).toBe(true)
  })

  it('contains all required sections', () => {
    const content = fs.readFileSync(docPath, 'utf8')
    const sections = [
      'Overview',
      'Architecture',
      'Data flow',
      'Routing rules',
      'Error handling',
      'Retry strategy',
      'Rate limiting',
      'Testing',
      'Troubleshooting',
      'Examples',
    ]
    for (const section of sections) {
      expect(content).toMatch(new RegExp(`^##\\s+${section}\\s*$`, 'm'))
    }
  })

  it('includes Mermaid diagrams', () => {
    const content = fs.readFileSync(docPath, 'utf8')
    expect(content).toContain('```mermaid')
  })

  it('media-management README links to the flow doc', () => {
    expect(fs.existsSync(readmePath)).toBe(true)
    const content = fs.readFileSync(readmePath, 'utf8')
    expect(content).toContain('MULTI-DEST-FLOW.md')
  })
})
