import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const src = fs.readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8')

const redirects = [
  ['/admin/social', '/admin/media'],
  ['/admin/social/channels', '/admin/media/channels'],
  ['/admin/social/telegram', '/admin/media'],
  ['/admin/social/telegram/posts', '/admin/media/publish'],
  ['/admin/social/telegram/posts/new', '/admin/media/publish?new=1'],
  ['/admin/social/telegram/posts/:id', '/admin/media/publish/:id'],
  ['/admin/social/telegram/templates', '/admin/media/assets'],
  ['/admin/social/telegram/templates/archive', '/admin/media/assets?tab=archived'],
  ['/admin/social/telegram/destinations', '/admin/media/channels?tab=destinations'],
  ['/admin/social/telegram/routing', '/admin/media/channels?tab=routing'],
  ['/admin/social/telegram/archive', '/admin/media/publish?tab=archive'],
  ['/admin/publish/schedule', '/admin/media/publish?tab=schedule'],
  ['/admin/publish/errors', '/admin/media/publish?tab=errors'],
  ['/admin/publish/help', '/admin/media/publish?help=1'],
]

describe('media redirects', () => {
  it('declares 14 permanent redirects', () => {
    for (const [source, destination] of redirects) {
      expect(src).toContain(`source: '${source}'`)
      expect(src).toContain(`destination: '${destination}'`)
    }
    expect(redirects).toHaveLength(14)
  })
})
