'use client'

import { memo } from 'react'
import type { JSX } from 'react'
import { sanitizeUrl } from '@/lib/sanitize'

interface MarkdownRendererProps {
  content: string
}

// Lightweight markdown renderer — handles headings, lists, bold, code blocks.
// Not a full CommonMark implementation; sufficient for our seeded content.
//
// Security: all link URLs are sanitized via `sanitizeUrl()` to prevent
// `javascript:` and other dangerous schemes from executing when a user clicks
// a link in a mod description.
export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = parseBlocks(content)
  return (
    <div className="prose prose-invert max-w-none space-y-4 text-sm font-medium leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const level = block.level || 2
          const Tag = `h${Math.min(level + 1, 4)}` as keyof JSX.IntrinsicElements
          const sizes: Record<number, string> = {
            1: 'text-2xl font-bold text-foreground',
            2: 'text-xl font-bold text-foreground',
            3: 'text-lg font-semibold text-foreground',
            4: 'text-base font-semibold text-foreground',
          }
          return (
            <Tag key={i} className={`mt-6 mb-2 ${sizes[level] || sizes[2]}`}>
              {renderInline(block.text)}
            </Tag>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {block.items?.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-6">
              {block.items?.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 text-xs"
            >
              <code className="font-mono text-foreground">{block.text}</code>
            </pre>
          )
        }
        // paragraph
        return (
          <p key={i} className="font-medium text-foreground">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
})

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; text: string }

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] })
      i++
      continue
    }
    // code block
    if (line.trim().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing
      blocks.push({ type: 'code', text: buf.join('\n') })
      continue
    }
    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    // paragraph (collect consecutive non-empty, non-special lines)
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('```')
    ) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: buf.join(' ') })
  }
  return blocks
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code`, [link](url), ~~strikethrough~~, <span style="color:...">
  const parts: React.ReactNode[] = []
  let rest = text
  let key = 0
  while (rest.length > 0) {
    // bold
    const bold = /\*\*(.+?)\*\*/.exec(rest)
    const italic = /\*(.+?)\*/.exec(rest)
    const code = /`(.+?)`/.exec(rest)
    const link = /\[(.+?)\]\((.+?)\)/.exec(rest)
    const strike = /~~(.+?)~~/.exec(rest)
    const colorSpan = /<span style="color:(.+?)">(.+?)<\/span>/.exec(rest)

    const matches = [
      bold ? { type: 'bold', match: bold, index: bold.index } : null,
      italic ? { type: 'italic', match: italic, index: italic.index } : null,
      code ? { type: 'code', match: code, index: code.index } : null,
      link ? { type: 'link', match: link, index: link.index } : null,
      strike ? { type: 'strike', match: strike, index: strike.index } : null,
      colorSpan ? { type: 'color', match: colorSpan, index: colorSpan.index } : null,
    ].filter(Boolean) as { type: string; match: RegExpExecArray; index: number }[]

    if (matches.length === 0) {
      parts.push(rest)
      break
    }

    matches.sort((a, b) => a.index - b.index)
    const first = matches[0]

    if (first.index > 0) {
      parts.push(rest.slice(0, first.index))
    }

    if (first.type === 'bold') {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {first.match[1]}
        </strong>,
      )
    } else if (first.type === 'italic') {
      parts.push(<em key={key++}>{first.match[1]}</em>)
    } else if (first.type === 'strike') {
      parts.push(
        <s key={key++} className="text-muted-foreground">
          {first.match[1]}
        </s>,
      )
    } else if (first.type === 'color') {
      const color = first.match[1]
      const text = first.match[2]
      // sanitize color — allow only hex
      const safeColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '#3b82f6'
      parts.push(
        <span key={key++} style={{ color: safeColor }}>
          {text}
        </span>,
      )
    } else if (first.type === 'code') {
      parts.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
        >
          {first.match[1]}
        </code>,
      )
    } else if (first.type === 'link') {
      // Sanitize the URL to prevent javascript: and other dangerous schemes.
      const safeHref = sanitizeUrl(first.match[2])
      if (safeHref) {
        parts.push(
          <a
            key={key++}
            href={safeHref}
            className="text-primary hover:underline"
            rel={safeHref.startsWith('http') ? 'noopener noreferrer' : undefined}
            target={safeHref.startsWith('http') ? '_blank' : undefined}
          >
            {first.match[1]}
          </a>,
        )
      } else {
        // URL was unsafe — render the link text without a hyperlink
        parts.push(
          <span key={key++} className="text-muted-foreground">
            {first.match[1]}
          </span>,
        )
      }
    }

    rest = rest.slice(first.index + first.match[0].length)
  }
  return parts
}
