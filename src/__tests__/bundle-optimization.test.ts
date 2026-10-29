import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('bundle optimization (static)', () => {
  it('creator dashboard uses dynamic import for chart', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/app/creator/(studio)/page.tsx'),
      'utf8',
    )
    expect(src).toContain("dynamic(")
    expect(src).toContain('ssr: false')
    expect(src).toContain('loading:')
  })

  it('admin analytics uses dynamic imports', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/app/admin/analytics/page.tsx'),
      'utf8',
    )
    expect(src).toContain("dynamic(")
  })

  it('next.config.ts has optimizePackageImports', () => {
    const src = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    expect(src).toContain('optimizePackageImports')
    expect(src).toContain('lucide-react')
    expect(src).toContain('recharts')
  })

  it('next.config.ts keeps serverExternalPackages separate from optimizePackageImports', () => {
    const src = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    // cloudinary/handlebars must only be in serverExternalPackages
    expect(src).toContain('serverExternalPackages')
    // They must not appear in optimizePackageImports block overlap check
    expect(src).toContain('"cloudinary"')
  })

  it('dynamic import modules resolve', async () => {
    const mod = await import('@/components/creator-dashboard/chart-area-interactive')
    expect(mod).toBeDefined()
  })
})
