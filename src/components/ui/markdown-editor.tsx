'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Bold, Italic, Heading2, List, Link as LinkIcon, Code } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minHeight?: number
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const [preview, setPreview] = useState(false)

  const wrap = (before: string, after: string = before) => {
    const ta = document.activeElement as HTMLTextAreaElement | null
    const start = ta?.selectionStart ?? value.length
    const end = ta?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || 'text'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
  }

  const insertLink = () => {
    const url = window.prompt('URL:')
    if (!url) return
    const ta = document.activeElement as HTMLTextAreaElement | null
    const start = ta?.selectionStart ?? value.length
    const end = ta?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || 'link'
    const next = value.slice(0, start) + `[${selected}](${url})` + value.slice(end)
    onChange(next)
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => wrap('**')}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => wrap('*')}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => wrap('## ', '')}>
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => wrap('- ', '')}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={insertLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => wrap('`')}>
          <Code className="h-3.5 w-3.5" />
        </Button>
        <div className="ms-auto">
          <Button type="button" size="sm" variant={preview ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setPreview((p) => !p)}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>
      {preview ? (
        <div className="p-3" style={{ minHeight }}>
          <MarkdownRenderer content={value} />
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] resize-y border-0 focus-visible:ring-0"
          style={{ minHeight }}
        />
      )}
    </div>
  )
}
