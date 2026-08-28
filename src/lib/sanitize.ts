/**
 * Sanitize a URL for safe use in `href` attributes.
 *
 * Allows `http:`, `https:`, `mailto:`, and `tel:` schemes plus relative URLs.
 * Blocks `javascript:`, `data:`, `vbscript:`, and anything else that could
 * execute script when clicked. This is the primary XSS defense for URLs that
 * come from user-authored content (e.g. markdown link syntax).
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  // Allow relative URLs (/, ./, ../, #, ?)
  if (/^[/?#]/.test(trimmed)) return trimmed

  // Allow explicit safe schemes
  if (/^(https?|mailto|tel):/i.test(trimmed)) return trimmed

  // Block everything else (javascript:, data:, vbscript:, etc.)
  return null
}

/**
 * Sanitize HTML content for safe rendering via dangerouslySetInnerHTML.
 *
 * يستخدم sanitize-html (بديل آمن للإنتاج بدلاً من jsdom/DOMPurify)
 * يوفر حماية XSS قوية بدون الاعتماد على jsdom الخارجي.
 */
import sanitizeHtml from 'sanitize-html'

export function sanitizeHTML(html: string): string {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
      'a', 'img', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'sup', 'sub'],
    allowedAttributes: {
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'table': ['colspan', 'rowspan', 'align', 'valign'],
      'th': ['colspan', 'rowspan', 'align', 'valign'],
      'td': ['colspan', 'rowspan', 'align', 'valign'],
      'div': ['class', 'style'],
      'span': ['class', 'style'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      'img': ['http', 'https', 'data'],
    },
    transformTags: {
      'a': (tagName, attribs) => {
        // تأمين الروابط الخارجية — فتح في تبويب جديد مع حماية
        if (attribs.href && !attribs.href.startsWith('/') && !attribs.href.startsWith('#') && !attribs.href.startsWith('mailto:') && !attribs.href.startsWith('tel:')) {
          return {
            tagName: 'a',
            attribs: {
              ...attribs,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          }
        }
        return { tagName, attribs }
      },
    },
  })
}
