import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '..')

describe('creator mods route error handling', () => {
  it('POST handler is wrapped in try/catch', () => {
    const content = fs.readFileSync(path.join(root, 'app/api/creator/mods/route.ts'), 'utf8')
    expect(content).toMatch(/export async function POST/)
    expect(content).toMatch(/try \{/)
    expect(content).toMatch(/catch \(err\)/)
    expect(content).toMatch(/internalError/)
  })

  it('MOD_RELATION_KEYS includes siteLinks', () => {
    const content = fs.readFileSync(path.join(root, 'lib/mod-relations.ts'), 'utf8')
    expect(content).toMatch(/'siteLinks'/)
  })
})
