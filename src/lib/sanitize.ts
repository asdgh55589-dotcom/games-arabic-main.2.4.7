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
 * Strips script tags, event handlers (on*), and dangerous attributes.
 * Allows safe HTML elements and attributes (headings, links, images, etc).
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''
  let result = html

  // Remove script tags (with content)
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove iframe, object, embed, form, input, textarea, select, button tags
  result = result.replace(/<\/?(?:iframe|object|embed|form|input|textarea|select|button)\b[^>]*>/gi, '')

  // Remove on* event handlers from all tags
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove javascript: and data: in href/src attributes
  result = result.replace(/((?:href|src|action)\s*=\s*)["']?\s*javascript\s*:/gi, '$1"')
  result = result.replace(/((?:href|src|action)\s*=\s*)["']?\s*data\s*:/gi, '$1"')

  return result
}
