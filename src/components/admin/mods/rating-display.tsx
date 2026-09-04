'use client'

import { Star } from 'lucide-react'

interface RatingDisplayProps {
  rating: number
  count?: number
  maxStars?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
}

const SIZE_MAP = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function RatingDisplay({
  rating,
  count = 0,
  maxStars = 5,
  size = 'md',
  showCount = true,
}: RatingDisplayProps) {
  const iconSize = SIZE_MAP[size]
  const fullStars = Math.floor(rating)
  const partialFill = rating - fullStars

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const fillPercent = i < fullStars ? 100 : i === fullStars ? partialFill * 100 : 0
          return (
            <div key={i} className="relative">
              <Star className={`${iconSize} text-muted-foreground/30`} fill="currentColor" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillPercent}%` }}
              >
                <Star className={`${iconSize} text-amber-400`} fill="currentColor" />
              </div>
            </div>
          )
        })}
      </div>
      {showCount && (
        <span
          className={`text-muted-foreground ${
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          }`}
        >
          ({count})
        </span>
      )}
    </div>
  )
}
