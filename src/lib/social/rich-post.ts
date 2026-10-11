/**
 * lib/social/rich-post.ts — معيار الكتل الغنية القابل للتخزين + البناء.
 *
 * القرار D4 (Social Hub، تحديث المالك #1): المنشورات تدعم «رسائل غنية»
 * من Bot API 10.3 عبر `tg-rich-messages`.
 *
 * لماذا معيار JSON خاص بدل تخزين كتل المكتبة مباشرة؟
 * كتل المكتبة إغلاقات (`render()` على كائن) وغير قابلة للحفظ/إعادة البناء
 * من JSON. لذلك `SocialPost.richDocument` يحفظ **مواصفة** مركّبة
 * (RichPostSpec، إصدار 1) ونُعيد بناء `RichDocument` وقت التحقق/المعاينة/
 * النشر عبر `doc()` — نفس مسار الإنتاج، بلا مسار منفصل للتخزين.
 *
 * الأنواع هنا إضافية فقط: `body` يبقى مطلوباً (نمط zod في الخطة بلا تغيير)،
 * ووضع «غني» يُحدَّد بأن `richDocument != null`.
 */

import {
  audio,
  type BlockNode,
  blockquote,
  bold,
  br,
  code,
  type DocumentOptions,
  details,
  divider,
  doc,
  footer,
  heading,
  type Inline,
  type InputRichMessage,
  italic,
  type ListItemInput,
  link,
  list,
  p,
  photo,
  pre,
  type RichDocument,
  spoiler,
  strike,
  sub,
  sup,
  type TableCellInput,
  table,
  underline,
  video,
} from './tg-rich'

export const RICH_POST_SPEC_VERSION = 1 as const

// ===== مواصفة سطرية (قابلة للتخزين) =====

export type RichInlineSpec =
  | string
  | { kind: 'bold'; children: RichInlineSpec[] }
  | { kind: 'italic'; children: RichInlineSpec[] }
  | { kind: 'underline'; children: RichInlineSpec[] }
  | { kind: 'strike'; children: RichInlineSpec[] }
  | { kind: 'code'; children: RichInlineSpec[] }
  | { kind: 'spoiler'; children: RichInlineSpec[] }
  | { kind: 'sub'; children: RichInlineSpec[] }
  | { kind: 'sup'; children: RichInlineSpec[] }
  | { kind: 'link'; href: string; children: RichInlineSpec[] }
  | { kind: 'br' }

// ===== مواصفة كتل (قابلة للتخزين) =====

export type RichBlockSpec =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: RichInlineSpec[] }
  | { kind: 'paragraph'; children: RichInlineSpec[] }
  | { kind: 'pre'; text: string; language?: string }
  | { kind: 'footer'; children: RichInlineSpec[] }
  | { kind: 'divider' }
  | { kind: 'blockquote'; children: RichBlockSpec[]; credit?: RichInlineSpec[] }
  | {
      kind: 'list'
      ordered?: boolean
      items: { children: RichBlockSpec[]; checkbox?: boolean; checked?: boolean }[]
    }
  | { kind: 'photo'; url: string; caption?: RichInlineSpec[] }
  | { kind: 'video'; url: string; caption?: RichInlineSpec[] }
  | { kind: 'audio'; url: string; caption?: RichInlineSpec[] }
  | { kind: 'table'; rows: RichInlineSpec[][][]; caption?: RichInlineSpec[] }
  | { kind: 'details'; summary: RichInlineSpec[]; children: RichBlockSpec[] }

export interface RichPostSpec {
  version: typeof RICH_POST_SPEC_VERSION
  blocks: RichBlockSpec[]
}

// ===== تحقّق الشكل (قبل البناء — لا يعتمد على المكتبة) =====

const INLINE_KINDS = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'spoiler',
  'sub',
  'sup',
  'link',
  'br',
])

const BLOCK_KINDS = new Set([
  'heading',
  'paragraph',
  'pre',
  'footer',
  'divider',
  'blockquote',
  'list',
  'photo',
  'video',
  'audio',
  'table',
  'details',
])

export interface RichSpecIssue {
  path: string
  message: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** هل القيمة مواصفة سطرية صالحة الشكل؟ (لا يتحقق من حدود تليجرام). */
export function isRichInlineSpec(value: unknown): value is RichInlineSpec {
  if (typeof value === 'string') return true
  if (!isObject(value)) return false
  const kind = value.kind
  if (typeof kind !== 'string' || !INLINE_KINDS.has(kind)) return false
  if (kind === 'br') return true
  if (kind === 'link') {
    return typeof value.href === 'string' && Array.isArray(value.children)
  }
  return Array.isArray(value.children)
}

/** هل القيمة مواصفة كتلة صالحة الشكل؟ */
export function isRichBlockSpec(value: unknown): value is RichBlockSpec {
  if (!isObject(value)) return false
  const kind = value.kind
  if (typeof kind !== 'string' || !BLOCK_KINDS.has(kind)) return false
  switch (kind) {
    case 'heading': {
      const level = value.level
      return (
        typeof level === 'number' &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= 6 &&
        Array.isArray(value.children)
      )
    }
    case 'paragraph':
    case 'footer':
      return Array.isArray(value.children)
    case 'pre':
      return typeof value.text === 'string'
    case 'divider':
      return true
    case 'blockquote':
      return Array.isArray(value.children) && value.children.every(isRichBlockSpec)
    case 'list':
      return (
        Array.isArray(value.items) &&
        value.items.every(
          (item) =>
            isObject(item) && Array.isArray(item.children) && item.children.every(isRichBlockSpec),
        )
      )
    case 'photo':
    case 'video':
    case 'audio':
      return (
        typeof value.url === 'string' &&
        value.url.length > 0 &&
        (value.caption === undefined || Array.isArray(value.caption))
      )
    case 'table':
      return (
        Array.isArray(value.rows) &&
        value.rows.every((row) => Array.isArray(row) && row.every(isRichInlineSpec)) &&
        (value.caption === undefined || Array.isArray(value.caption))
      )
    case 'details':
      return Array.isArray(value.summary) && Array.isArray(value.children)
    default:
      return false
  }
}

/** هل القيمة مواصفة كاملة (إصدار مدعوم + كتل)؟ */
export function isRichPostSpec(value: unknown): value is RichPostSpec {
  return (
    isObject(value) &&
    value.version === RICH_POST_SPEC_VERSION &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every(isRichBlockSpec)
  )
}

// ===== البناء: المواصفة → كتل المكتبة → RichDocument =====

function toInline(spec: readonly RichInlineSpec[]): Inline {
  return spec.map((node): Inline => {
    if (typeof node === 'string') return node
    switch (node.kind) {
      case 'bold':
        return bold(toInline(node.children))
      case 'italic':
        return italic(toInline(node.children))
      case 'underline':
        return underline(toInline(node.children))
      case 'strike':
        return strike(toInline(node.children))
      case 'code':
        return code(toInline(node.children))
      case 'spoiler':
        return spoiler(toInline(node.children))
      case 'sub':
        return sub(toInline(node.children))
      case 'sup':
        return sup(toInline(node.children))
      case 'link':
        return link(toInline(node.children), node.href)
      case 'br':
        return br()
      default:
        return ''
    }
  })
}

function toBlockNodes(spec: readonly RichBlockSpec[]): BlockNode[] {
  return spec.map((block): BlockNode => {
    switch (block.kind) {
      case 'heading':
        return heading(block.level, toInline(block.children))
      case 'paragraph':
        return p(toInline(block.children))
      case 'pre':
        return pre(block.text, block.language)
      case 'footer':
        return footer(toInline(block.children))
      case 'divider':
        return divider()
      case 'blockquote':
        return blockquote(
          toBlockNodes(block.children),
          block.credit ? toInline(block.credit) : undefined,
        )
      case 'list': {
        const items: ListItemInput[] = block.items.map((item) => {
          if (item.checkbox === true) {
            return {
              content: toBlockNodes(item.children),
              checkbox: true,
              checked: item.checked === true,
            }
          }
          return toBlockNodes(item.children)
        })
        return list(items, { ordered: block.ordered === true })
      }
      case 'photo':
        return photo(block.url, { caption: block.caption ? toInline(block.caption) : undefined })
      case 'video':
        return video(block.url, { caption: block.caption ? toInline(block.caption) : undefined })
      case 'audio':
        return audio(block.url, { caption: block.caption ? toInline(block.caption) : undefined })
      case 'table': {
        const rows: TableCellInput[][] = block.rows.map((row) =>
          row.map((cell): TableCellInput => toInline(cell)),
        )
        return table(rows, { caption: block.caption ? toInline(block.caption) : undefined })
      }
      case 'details':
        return details(toInline(block.summary), toBlockNodes(block.children))
      default:
        return divider()
    }
  })
}

/**
 * بناء `RichDocument` من مواصفة مخزَّنة. يرمي إذا كانت المواصفة غير صالحة
 * الشكل — استدعِ `isRichPostSpec` أولاً في طبقات API.
 */
export function buildRichDocument(spec: RichPostSpec): RichDocument {
  return doc(toBlockNodes(spec.blocks))
}

/** HTML النهائي للمواصفة (عبر `toHTML()` — لا اقتطاع نص يدوي). */
export function renderRichPostHtml(spec: RichPostSpec): string {
  return buildRichDocument(spec).toHTML()
}

/**
 * تحويل المواصفة إلى `InputRichMessage` جاهز لـ `sendRichMessage`.
 * العربية = `isRtl: true` افتراضياً (الواجهة RTL).
 */
export function toRichMessageInput(
  spec: RichPostSpec,
  options: { isRtl?: boolean; skipEntityDetection?: boolean } = {},
): InputRichMessage {
  const opts: DocumentOptions = {
    isRtl: options.isRtl ?? true,
    skipEntityDetection: options.skipEntityDetection,
  }
  return buildRichDocument(spec).toInputRichMessage(opts)
}

// ===== مقاييس للمعاينة/التحقق =====

/** عدد الكتل (بما فيها المتداخلة وعناصر القوائم وصفوف الجداول). */
export function countRichSpecBlocks(spec: RichPostSpec): number {
  let count = 0
  const walkBlocks = (blocks: readonly RichBlockSpec[]): void => {
    for (const block of blocks) {
      count += 1
      switch (block.kind) {
        case 'blockquote':
        case 'details':
          walkBlocks(block.children)
          break
        case 'list':
          for (const item of block.items) walkBlocks(item.children)
          break
        default:
          break
      }
    }
  }
  walkBlocks(spec.blocks)
  return count
}

/** عدد مرفقات الوسائط في المواصفة. */
export function countRichSpecMedia(spec: RichPostSpec): number {
  let count = 0
  const walkBlocks = (blocks: readonly RichBlockSpec[]): void => {
    for (const block of blocks) {
      if (block.kind === 'photo' || block.kind === 'video' || block.kind === 'audio') count += 1
      if (block.kind === 'blockquote' || block.kind === 'details') walkBlocks(block.children)
      if (block.kind === 'list') for (const item of block.items) walkBlocks(item.children)
    }
  }
  walkBlocks(spec.blocks)
  return count
}

/** أقصى عمق تداخل في المواصفة (الجذر = 1). */
export function measureRichSpecDepth(spec: RichPostSpec): number {
  let max = 0
  const walkBlocks = (blocks: readonly RichBlockSpec[], depth: number): void => {
    if (depth > max) max = depth
    for (const block of blocks) {
      if (block.kind === 'blockquote' || block.kind === 'details') {
        walkBlocks(block.children, depth + 1)
      } else if (block.kind === 'list') {
        for (const item of block.items) walkBlocks(item.children, depth + 1)
      }
    }
  }
  walkBlocks(spec.blocks, 1)
  return max
}

/** أقصى عدد أعمدة في أي جدول. */
export function measureRichSpecTableColumns(spec: RichPostSpec): number {
  let max = 0
  const walkBlocks = (blocks: readonly RichBlockSpec[]): void => {
    for (const block of blocks) {
      if (block.kind === 'table') {
        for (const row of block.rows) if (row.length > max) max = row.length
      }
      if (block.kind === 'blockquote' || block.kind === 'details') walkBlocks(block.children)
      if (block.kind === 'list') for (const item of block.items) walkBlocks(item.children)
    }
  }
  walkBlocks(spec.blocks)
  return max
}
