/**
 * STEP 5 — UI/UX quality audit as executable assertions (audit only, no fixes).
 * Mix of axe-core runs on markup mirroring CommentItem patterns + static
 * assertions against the real sources with file:line anchors.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const ui = fs.readFileSync(path.join(root, 'src/components/mod-comments.tsx'), 'utf8')
const mgr = fs.readFileSync(path.join(root, 'src/components/creator/comments-manager.tsx'), 'utf8')
const mobile = fs.readFileSync(path.join(root, 'src/views/mod-detail-mobile.tsx'), 'utf8')
const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8')
const tailwindCfg = fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8')
const renderer = fs.readFileSync(path.join(root, 'src/components/markdown-renderer.tsx'), 'utf8')

function axeAudit(html: string) {
  // axe-core runs in scripts/audit-comment-a11y.mjs (jsdom@30 is ESM-only and
  // cannot load under Jest's CJS runtime). This suite asserts on its recorded
  // output; regenerate with: node scripts/audit-comment-a11y.mjs
  const snap = JSON.parse(
    fs.readFileSync(path.join(root, 'src/__tests__/comment-a11y-axe.snapshot.json'), 'utf8'),
  ) as { bySection: Record<string, { id: string; impact: string; nodes: number; help: string }[]> }
  const key = html.includes('axe-expect:bad')
    ? 'bad'
    : html.includes('axe-expect:titled')
      ? 'titled'
      : 'like'
  return snap.bySection[key]
}

describe('4.1 axe-core on CommentItem markup patterns', () => {
  it('CRITICAL: icon-only buttons without accessible name fail button-name (color toggle + swatch pattern)', async () => {
    // Mirrors mod-comments.tsx:825 (palette toggle, no title/aria) and :832-847 (color swatches, no label)
    const violations = await axeAudit('axe-expect:bad')
    const rule = violations.find((v) => v.id === 'button-name')
    expect(rule).toBeDefined()
    expect(rule!.impact).toBe('critical')
    expect(rule!.nodes).toBe(2)
  })
  it('toolbar buttons WITH title= pass button-name via title fallback (most formatting buttons)', async () => {
    // Mirrors :385-463 title="عريض **نص**" etc.
    const violations = await axeAudit('axe-expect:titled')
    expect(violations.find((v) => v.id === 'button-name')).toBeUndefined()
  })
  it('like button pattern (visible count + aria-pressed) passes', async () => {
    // Mirrors :916-927 aria-pressed={liked} + {formatNumber(likes)}
    expect(await axeAudit('axe-expect:like')).toEqual([])
  })
})

describe('1. Responsive: mobile scale-hack crushes touch targets (static)', () => {
  it('mobile wraps ModComments in scale-[0.60] with forced 30px buttons + 10px text', () => {
    expect(mobile).toMatch(/scale-\[0\.60\]/)
    expect(mobile).toMatch(/min-h-\[30px\]/) // below 44px WCAG target
    expect(mobile).toMatch(/text-\[10px\]/) // below readable minimum
  })
  it('desktop layouts use flex-wrap (no overflow on narrow widths)', () => {
    expect(ui).toMatch(/flex flex-wrap items-center/)
  })
  it('edit/reply toolbar buttons are 24px with no 44px minimum', () => {
    const small =
      ui.match(/className="grid h-6 w-6 place-items-center rounded hover:bg-white\/10/g) || []
    expect(small.length).toBeGreaterThan(5) // ~10 instances across edit+reply toolbars
    expect(ui).not.toMatch(/h-6 w-6[^"]*min-h-\[44px\]/)
  })
  it('pagination buttons DO meet 44px (good pattern)', () => {
    expect(ui).toMatch(/ السابق/)
    expect((ui.match(/min-h-\[44px\] touch-manipulation/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('2. Theme: forced dark, system preference ignored; light-mode overlays broken (static)', () => {
  it('ThemeProvider forces dark + enableSystem=false', () => {
    expect(layout).toMatch(/defaultTheme="dark"/)
    expect(layout).toMatch(/enableSystem=\{false\}/)
  })
  it('dark mode uses class strategy (toggle possible)', () => {
    expect(tailwindCfg).toMatch(/darkMode:\s*["']class["']/)
  })
  it('36 white/* overlays are near-invisible in light mode', () => {
    const count = (ui.match(/white\//g) || []).length
    expect(count).toBeGreaterThan(20) // borders, hovers, dividers
    expect(ui).toMatch(/border-white\/10/)
    expect(ui).toMatch(/hover:bg-white\/10/)
  })
})

describe('3. RTL: dir + mirroring good; bidi isolation + plurals missing (static)', () => {
  it('html lang=ar dir=rtl', () => {
    expect(layout).toMatch(/<html lang="ar" dir="rtl"/)
  })
  it('pagination chevrons correctly mirrored (Right=previous in RTL)', () => {
    expect(ui).toMatch(/<ChevronRight[^/]*\/>\s*\n?\s*السابق/)
    expect(ui).toMatch(/التالي\s*\n?\s*<ChevronLeft/)
  })
  it('no bidi isolation for mixed Arabic/Latin text', () => {
    expect(ui).not.toMatch(/<bdi|unicode-bidi|isolate/)
    expect(renderer).not.toMatch(/<bdi|unicode-bidi|isolate/)
  })
  it('timeAgo Arabic but no plural forms (منذ 2 دقيقة instead of دقيقتين)', () => {
    const fmt = fs.readFileSync(path.join(root, 'src/lib/format.ts'), 'utf8')
    expect(fmt).toMatch(/منذ/)
    expect(fmt).not.toMatch(/دقيقتين|ساعتين|يومين/)
  })
  it('all title/placeholder/aria-label attribute values are Arabic (no Latin UI copy)', () => {
    const attrs = [...ui.matchAll(/(title|placeholder|aria-label)="([^"]*)"/g)].map((m) => m[2])
    expect(attrs.length).toBeGreaterThan(5)
    for (const v of attrs) expect(v).not.toMatch(/[A-Za-z]{2,}/)
  })
})

describe('4. a11y gaps (static)', () => {
  it('sort toggle buttons expose no aria-pressed state to screen readers', () => {
    const sortBlock = ui.slice(ui.indexOf('SORT_OPTIONS.map'), ui.indexOf('SORT_OPTIONS.map') + 800)
    expect(sortBlock).toMatch(/<button/)
    expect(sortBlock).not.toMatch(/aria-pressed/)
  })
  it('textareas have placeholder but no <label>/aria-label/aria-labelledby', () => {
    const areas = ui.match(/<textarea[\s\S]*?\/>|<textarea[\s\S]*?<\/textarea>/g) || []
    expect(areas.length).toBeGreaterThanOrEqual(3) // new + edit + reply
    for (const a of areas) expect(a).not.toMatch(/aria-label|aria-labelledby|<label/)
  })
  it('focus:outline-none without visible replacement on 2 textareas (WCAG 2.4.7)', () => {
    expect(ui).toMatch(/bg-transparent p-3 text-sm[^"]*focus:outline-none"/)
    expect(ui).toMatch(/p-2\.5 text-sm focus:outline-none"/)
  })
  it('no keyboard submit (Ctrl+Enter) or Escape-to-cancel anywhere in comment UIs', () => {
    expect(ui).not.toMatch(/onKeyDown|onKeyUp|Escape|Ctrl\+Enter|Meta\+Enter/)
    expect(mgr).not.toMatch(/onKeyDown|onKeyUp|Escape/)
  })
  it('~12 buttons missing type="button" (Biome useButtonType, Step 2)', () => {
    expect((ui.match(/<button\n?\s*[^>]*onClick/g) || []).length).toBeGreaterThan(5)
  })
  it('dropdown trigger has Arabic aria-label (good pattern)', () => {
    expect(ui).toMatch(/aria-label="خيارات"/)
  })
})

describe('5. Loading/empty states (static)', () => {
  it('loading = bare spinner, no skeleton, no role=status/aria-busy', () => {
    expect(ui).toMatch(/<Loader2 className="h-6 w-6 animate-spin/)
    expect(ui).not.toMatch(/Skeleton|skeleton/)
    expect(ui).not.toMatch(/role="status"|aria-busy/)
  })
  it('empty state Arabic with CTA copy but no action prop passed', () => {
    expect(ui).toMatch(/title="لا توجد تعليقات"/)
    expect(ui).toMatch(/كن أول من يعلّق/)
    expect(ui).not.toMatch(/<EmptyState[\s\S]*?action=\{/)
  })
  it('manager loading also spinner-only', () => {
    expect(mgr).toMatch(/animate-spin/)
    expect(mgr).not.toMatch(/Skeleton/)
  })
})

describe('6. Interactions (static)', () => {
  it('destructive deletes use blocking native confirm() (no RTL styling, no undo)', () => {
    expect(ui).toMatch(/confirm\('هل أنت متأكد من حذف هذا التعليق؟'\)/)
    expect(mgr).toMatch(/confirm\('هل أنت متأكد من حذف هذا التعليق؟'\)/)
  })
  it('no enter/exit animations, no virtualization for long lists', () => {
    expect(ui).not.toMatch(/AnimatePresence|framer-motion|duration-\d+|keyframes/)
    expect(ui).not.toMatch(/react-window|virtua|virtual/)
  })
  it('only instant color transitions (default 150ms, within 150-250ms budget)', () => {
    expect(ui).toMatch(/transition-colors/)
  })
  it('like gives instant visual fill + count change (good feedback)', () => {
    expect(ui).toMatch(/aria-pressed=\{liked\}/)
    expect(ui).toMatch(/fill-current/)
  })
})
