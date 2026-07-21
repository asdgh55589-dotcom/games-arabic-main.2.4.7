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
 * Uses DOMPurify for robust XSS protection — regex-based sanitization
 * is inherently bypassable.
 */
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHTML(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
      'a', 'img', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'sup', 'sub'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'class', 'style',
      'target', 'rel', 'colspan', 'rowspan', 'align', 'valign'],
    ALLOW_DATA_ATTR: false,
  })
}
