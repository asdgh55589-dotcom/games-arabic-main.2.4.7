'use client'

import { Bold, Eye, EyeOff, Heading1, Heading2, Heading3, Italic, List } from 'lucide-react'
import { useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

const TOOLBAR_ITEMS = [
  { icon: Bold, label: 'عريض', before: '**', after: '**' },
  { icon: Italic, label: 'مائل', before: '*', after: '*' },
  { icon: Heading1, label: 'عنوان 1', before: '# ', after: '' },
  { icon: Heading2, label: 'عنوان 2', before: '## ', after: '' },
  { icon: Heading3, label: 'عنوان 3', before: '### ', after: '' },
  { icon: List, label: 'قائمة', before: '- ', after: '' },
]

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'اكتب الوصف هنا...',
  rows = 6,
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)

  const insertMarkdown = (before: string, after: string) => {
    if (!textareaRef) return
    const start = textareaRef.selectionStart
    const end = textareaRef.selectionEnd
    const selected = value.slice(start, end)
    const replacement = before + (selected || 'نص') + after
    const newValue = value.slice(0, start) + replacement + value.slice(end)
    onChange(newValue)
    setTimeout(() => {
      textareaRef.focus()
      const newCursorPos = start + before.length + (selected ? selected.length : 2)
      textareaRef.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  return (
    <div className="rounded-md border border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
        {TOOLBAR_ITEMS.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => insertMarkdown(item.before, item.after)}
            title={item.label}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <item.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors ${
            showPreview
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? 'إخفاء المعاينة' : 'معاينة'}
        </button>
      </div>

      {/* Editor + Preview */}
      {showPreview ? (
        <div className="grid grid-cols-2 divide-x divide-border">
          <textarea
            ref={setTextareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full resize-none bg-transparent p-3 text-sm outline-none"
            dir="rtl"
          />
          <div className="max-h-[240px] overflow-y-auto p-3" dir="rtl">
            {value ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-xs text-muted-foreground">المعاينة ستظهر هنا...</p>
            )}
          </div>
        </div>
      ) : (
        <textarea
          ref={setTextareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-none bg-transparent p-3 text-sm outline-none"
          dir="rtl"
        />
      )}
    </div>
  )
}
