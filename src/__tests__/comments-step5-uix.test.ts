/**
 * STEP 5 (revised STEP 8 Phase 4) — UI/UX verification asserting the FIXED state.
 * Regenerate axe data with: node scripts/audit-comment-a11y.mjs
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const commentFiles = [
  'src/components/mod-comments.tsx',
  'src/components/comments/comment-card.tsx',
  'src/components/comments/comment-toolbar.tsx',
  'src/components/comments/reply-box.tsx',
  'src/components/comments/use-comments.ts',
  'src/components/comments/use-comment-actions.ts',
  'src/components/comments/comment-header.tsx',
  'src/components/comments/comment-edit-box.tsx',
  'src/components/comments/comment-skeleton.tsx',
  'src/components/creator/comments-manager.tsx',
]
const uiFiles = [
  ...commentFiles,
  'src/views/mod-detail-mobile.tsx',
  'src/app/layout.tsx',
  'src/lib/format.ts',
]
function readOpt(f: string): string {
  try {
    return fs.readFileSync(path.join(root, f), 'utf8')
  } catch {
    return ''
  }
}
const ui = uiFiles.map(readOpt).join('\n')
const commentsOnly = commentFiles.map(readOpt).join('\n')

function axeSnapshot(): Record<
  string,
  { id: string; impact: string; nodes: number; help: string }[]
> {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'src/__tests__/comment-a11y-axe.snapshot.json'), 'utf8'),
  ).bySection
}

describe('4.1 axe-core guards (icon buttons must have names)', () => {
  it('unlabeled icon-button pattern still fails button-name (rule guard)', async () => {
    const bad = axeSnapshot().bad
    const rule = bad.find((v) => v.id === 'button-name')
    expect(rule).toBeDefined()
    expect(rule!.impact).toBe('critical')
  })
  it('real toolbar exposes aria-labels (no unlabeled icon buttons in code)', () => {
    const toolbar = fs.readFileSync(
      path.join(root, 'src/components/comments/comment-toolbar.tsx'),
      'utf8',
    )
    expect(toolbar).not.toMatch(
      /<button(?![\s\S]{0,400}aria-label)(?![\s\S]{0,400}title=)[\s\S]*?>\s*<(Palette|Smile|Bold|Italic|Strikethrough|Heading2)/,
    )
  })
})

describe('1. Responsive: native mobile layout, 44px targets', () => {
  it('mobile renders ModComments WITHOUT scale hack', () => {
    const mobile = fs.readFileSync(path.join(root, 'src/views/mod-detail-mobile.tsx'), 'utf8')
    expect(mobile).not.toMatch(/scale-\[0\.60\]/)
    expect(mobile).not.toMatch(/min-h-\[30px\]/)
    expect(mobile).toMatch(/<ModComments/)
  })
  it('unified toolbar buttons meet 44px minimum', () => {
    const toolbar = fs.readFileSync(
      path.join(root, 'src/components/comments/comment-toolbar.tsx'),
      'utf8',
    )
    expect(toolbar).toMatch(/min-h-\[44px\] min-w-\[44px\]/)
  })
})

describe('2. Theme: system preference respected; no raw white/* overlays in comments', () => {
  it('ThemeProvider follows the OS theme', () => {
    const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8')
    expect(layout).toMatch(/defaultTheme="system"/)
    expect(layout).not.toMatch(/enableSystem=\{false\}/)
  })
  it('comment files use theme tokens instead of white/* overlays', () => {
    expect(commentsOnly).not.toMatch(/white\//)
  })
})

describe('3. RTL: dir + mirroring + bidi isolation + plurals', () => {
  it('html lang=ar dir=rtl', () => {
    expect(ui).toMatch(/<html lang="ar" dir="rtl"/)
  })
  it('display names isolated with <bdi>', () => {
    const header = fs.readFileSync(
      path.join(root, 'src/components/comments/comment-header.tsx'),
      'utf8',
    )
    expect(header).toMatch(/<bdi>/)
  })
  it('timeAgo has dual/plural Arabic forms', () => {
    const fmt = fs.readFileSync(path.join(root, 'src/lib/format.ts'), 'utf8')
    expect(fmt).toMatch(/دقيقتين|ساعتين|يومين/)
    expect(fmt).toMatch(/دقائق|ساعات/)
  })
  it('all title/placeholder/aria-label values remain Arabic', () => {
    const attrs = [...commentsOnly.matchAll(/(title|placeholder|aria-label)="([^"]*)"/g)].map(
      (m) => m[2],
    )
    expect(attrs.length).toBeGreaterThan(5)
    for (const v of attrs) expect(v).not.toMatch(/[A-Za-z]{2,}/)
  })
})

describe('4. a11y: labels, focus, keyboard, dialogs, button types', () => {
  it('sort toggle buttons expose aria-pressed', () => {
    expect(commentsOnly).toMatch(/aria-pressed=\{sortMode === opt\.value\}/)
  })
  it('all comment textareas carry aria-label', () => {
    for (const f of [
      'src/components/mod-comments.tsx',
      'src/components/comments/comment-edit-box.tsx',
      'src/components/comments/reply-box.tsx',
      'src/components/creator/comments-manager.tsx',
    ]) {
      const src = fs.readFileSync(path.join(root, f), 'utf8')
      const areas = src.match(/<textarea[\s\S]*?\/>|<Textarea[\s\S]*?\/>/g) || []
      expect(areas.length).toBeGreaterThan(0)
      for (const a of areas) expect(a).toMatch(/aria-label=/)
    }
  })
  it('no focus:outline-none without a visible replacement', () => {
    expect(commentsOnly).not.toMatch(/focus:outline-none"/)
  })
  it('Ctrl+Enter submits, Escape cancels reply', () => {
    expect(commentsOnly).toMatch(/onKeyDown/)
    expect(commentsOnly).toMatch(/Control.*Enter|Enter.*Control|ctrlKey/)
    expect(commentsOnly).toMatch(/Escape/)
  })
  it('destructive deletes use Radix AlertDialog (no native confirm)', () => {
    const codeOnly = commentsOnly.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)\s*\/\/.*/g, '')
    expect(codeOnly).not.toMatch(/[^a-zA-Z]confirm\(/)
    expect(commentsOnly).toMatch(/AlertDialog/)
  })
  it('every raw <button> in comment UI has type="button"', () => {
    const withoutType = [...commentsOnly.matchAll(/<button(?![^>]*type=)[^>]*>/g)].map((m) => m[0])
    expect(withoutType).toEqual([])
  })
})

describe('5. Loading/error states: skeletons, live regions, retry', () => {
  it('comment skeleton component exists and is used while loading', () => {
    expect(fs.existsSync(path.join(root, 'src/components/comments/comment-skeleton.tsx'))).toBe(
      true,
    )
    expect(commentsOnly).toMatch(/CommentSkeleton/)
  })
  it('loading and error regions use role="status"', () => {
    expect(commentsOnly).toMatch(/role="status"/)
  })
  it('failed loads offer a retry button (no silent dead-ends)', () => {
    expect(commentsOnly).toMatch(/إعادة المحاولة|حاول مجدداً/)
  })
  it('empty state copy stays Arabic with CTA', () => {
    expect(commentsOnly).toMatch(/لا توجد تعليقات/)
    expect(commentsOnly).toMatch(/كن أول من يعلّق/)
  })
})

describe('6. Interactions: transitions kept, like feedback kept', () => {
  it('instant color transitions preserved', () => {
    expect(commentsOnly).toMatch(/transition-colors/)
  })
  it('like keeps aria-pressed + fill feedback', () => {
    expect(commentsOnly).toMatch(/aria-pressed=\{liked\}/)
    expect(commentsOnly).toMatch(/fill-current/)
  })
})
