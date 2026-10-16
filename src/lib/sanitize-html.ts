/**
 * lib/sanitize-html.ts — HTML sanitizer (heavy: sanitize-html + htmlparser2).
 *
 * Split from lib/sanitize.ts on purpose (Section 4 item 24): the pure
 * `sanitizeUrl` helper must stay lightweight for first-paint client bundles
 * (markdown-renderer), while this module is only imported by deferred paths
 * (homepage AdSection, dynamically loaded). Do NOT import this from
 * first-paint components — use `@/lib/sanitize` instead.
 */
import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize HTML content for safe rendering via dangerouslySetInnerHTML.
 *
 * يستخدم sanitize-html (بديل آمن للإنتاج بدلاً من jsdom/DOMPurify)
 * يوفر حماية XSS قوية بدون الاعتماد على jsdom الخارجي.
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'code',
      'pre',
      'blockquote',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
      'sup',
      'sub',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      table: ['colspan', 'rowspan', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'align', 'valign'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
      div: ['class', 'style'],
      span: ['class', 'style'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        // تأمين الروابط الخارجية — فتح في تبويب جديد مع حماية
        if (
          attribs.href &&
          !attribs.href.startsWith('/') &&
          !attribs.href.startsWith('#') &&
          !attribs.href.startsWith('mailto:') &&
          !attribs.href.startsWith('tel:')
        ) {
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
