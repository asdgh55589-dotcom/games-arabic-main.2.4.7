'use client'

import { Bold, Heading2, Italic, Palette, Smile, Strikethrough } from 'lucide-react'
import { type RefObject, useState } from 'react'

export const EMOJIS = [
  '😀',
  '😁',
  '😂',
  '🤣',
  '😍',
  '😘',
  '🥰',
  '😎',
  '🤩',
  '🥳',
  '😢',
  '😭',
  '😡',
  '🤔',
  '👍',
  '👏',
  '❤️',
  '🔥',
  '🎉',
  '✨',
  '🙏',
  '💯',
  '😅',
  '🤗',
  '🫡',
  '👌',
]

export const COLORS = [
  { name: 'أحمر', value: '#ef4444' },
  { name: 'أزرق', value: '#3b82f6' },
  { name: 'أخضر', value: '#22c55e' },
  { name: 'برتقالي', value: '#f97316' },
  { name: 'بنفسجي', value: '#a855f7' },
  { name: 'وردي', value: '#ec4899' },
]

export function wrapSelection(
  textarea: HTMLTextAreaElement | null,
  setValue: (v: string) => void,
  prefix: string,
  suffix: string,
  placeholder = 'نص',
) {
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end) || placeholder
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
  setValue(newValue)
  // إعادة التركيز وتحديد النص الجديد
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
  })
}

export function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  setValue: (v: string) => void,
  text: string,
) {
  if (!textarea) {
    setValue(text)
    return
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const newValue = value.slice(0, start) + text + value.slice(end)
  setValue(newValue)
  requestAnimationFrame(() => {
    textarea.focus()
    const pos = start + text.length
    textarea.setSelectionRange(pos, pos)
  })
}

interface CommentToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  setValue: (v: string) => void
}

/** شريط تنسيق موحّد (عريض/مائل/مشطوب/عنوان/لون/إيموجي) — كان مكرراً 3 مرات */
export function CommentToolbar({ textareaRef, setValue }: CommentToolbarProps) {
  const [showColor, setShowColor] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const btn =
    'grid h-7 w-7 min-h-[44px] min-w-[44px] place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/50 bg-muted/30 p-1.5">
      <button
        type="button"
        onClick={() => wrapSelection(textareaRef.current, setValue, '**', '**', 'نص عريض')}
        className={btn}
        title="عريض **نص**"
        aria-label="نص عريض"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => wrapSelection(textareaRef.current, setValue, '*', '*', 'نص مائل')}
        className={btn}
        title="مائل *نص*"
        aria-label="نص مائل"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => wrapSelection(textareaRef.current, setValue, '~~', '~~', 'نص مشطوب')}
        className={btn}
        title="مشطوب ~~نص~~"
        aria-label="نص مشطوب"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => wrapSelection(textareaRef.current, setValue, '## ', '', 'عنوان كبير')}
        className={btn}
        title="تكبير ## عنوان"
        aria-label="عنوان"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-accent" aria-hidden />
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColor(!showColor)}
          className={`${btn} ${showColor ? 'bg-accent text-foreground' : ''}`}
          title="لون النص"
          aria-label="لون النص"
          aria-expanded={showColor}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        {showColor && (
          <div className="absolute top-8 start-0 z-20 flex gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                title={c.name}
                aria-label={`لون ${c.name}`}
                onClick={() => {
                  wrapSelection(
                    textareaRef.current,
                    setValue,
                    `<span style="color:${c.value}">`,
                    `</span>`,
                    'نص ملون',
                  )
                  setShowColor(false)
                }}
                className="h-6 w-6 rounded-full border-2 border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value }}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowColor(false)}
              aria-label="إغلاق منتقي الألوان"
              className="ms-1 text-[10px] text-muted-foreground hover:text-foreground px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className={`${btn} ${showEmoji ? 'bg-accent text-foreground' : ''}`}
          title="إيموجي"
          aria-label="إيموجي"
          aria-expanded={showEmoji}
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
        {showEmoji && (
          <div className="absolute top-8 start-0 z-20 grid grid-cols-7 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl w-56">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => {
                  insertAtCursor(textareaRef.current, setValue, e)
                  setShowEmoji(false)
                }}
                className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-sm"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
