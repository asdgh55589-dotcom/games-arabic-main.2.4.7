import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '..')

const routes = [
  'app/api/admin/mods/route.ts',
  'app/api/admin/mods/[id]/route.ts',
  'app/api/creator/mods/route.ts',
  'app/api/creator/mods/[id]/route.ts',
]

describe('mod routes maxDuration', () => {
  for (const r of routes) {
    it(`${r} exports maxDuration = 60`, () => {
      const content = fs.readFileSync(path.join(root, r), 'utf8')
      expect(content).toMatch(/export\s+const\s+maxDuration\s*=\s*60/)
    })
  }
})

describe('admin mod route fire-and-forget notification', () => {
  it('uses fire-and-forget for sendModPublished', () => {
    const content = fs.readFileSync(
      path.join(root, 'app/api/admin/mods/route.ts'),
      'utf8',
    )
    expect(content).toMatch(/sendModPublished\.execute/)
    expect(content).toMatch(/\.catch\(/)
  })
})
