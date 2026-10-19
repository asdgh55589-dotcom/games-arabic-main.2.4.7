'use client'

import { formatNumber } from '@/lib/format'

interface Reactions {
  fire: number
  sparkle: number
  thumbsup: number
  thumbsdown: number
}

interface ModReactionsProps {
  reactions: Reactions
  userReaction: string | null
  onReact: (reaction: 'fire' | 'sparkle' | 'thumbsup' | 'thumbsdown') => void
}

const META: Record<keyof Reactions, { emoji: string; label: string; color: string; bar: string }> = {
  fire: { emoji: '🔥', label: 'ممتاز', color: 'text-emerald-400', bar: 'bg-emerald-500' },
  sparkle: { emoji: '✨', label: 'جيد جداً', color: 'text-sky-400', bar: 'bg-sky-500' },
  thumbsup: { emoji: '👍', label: 'يصلح', color: 'text-amber-400', bar: 'bg-amber-500' },
  thumbsdown: { emoji: '👎', label: 'لا يُنصح', color: 'text-red-400', bar: 'bg-red-500' },
}

const ORDER: (keyof Reactions)[] = ['fire', 'sparkle', 'thumbsup', 'thumbsdown']

export function ModReactions({ reactions, userReaction, onReact }: ModReactionsProps) {
  const total =
    reactions.fire + reactions.sparkle + reactions.thumbsup + reactions.thumbsdown

  return (
    <div className="flex flex-col gap-2">
      {ORDER.map((key) => {
        const meta = META[key]
        const count = reactions[key]
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const active = userReaction === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onReact(key)}
            className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-right transition-all ${
              active
                ? 'border-primary bg-primary/10'
                : 'border-border/40 bg-card/40 hover:border-border/70 hover:bg-card/60'
            }`}
          >
            <span className="text-lg leading-none">{meta.emoji}</span>
            <span className="w-20 shrink-0 text-xs font-black text-foreground/80">{meta.label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${meta.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`w-12 shrink-0 text-end text-xs font-black tabular-nums ${meta.color}`}>
              {formatNumber(count)}
            </span>
            <span className="w-10 shrink-0 text-end text-[10px] font-bold tabular-nums text-foreground/50">
              {pct}%
            </span>
          </button>
        )
      })}
      {total === 0 && (
        <p className="text-center text-[11px] text-foreground/40">لا توجد تقييمات بعد</p>
      )}
    </div>
  )
}
