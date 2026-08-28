'use client'

import { Star } from 'lucide-react'

const XP_LEVELS = [
  { min: 0, max: 100, name: 'مبتدئ', icon: '🌱' },
  { min: 101, max: 300, name: 'متعلم', icon: '📚' },
  { min: 301, max: 600, name: 'ماهر', icon: '⚡' },
  { min: 601, max: 1000, name: 'محترف', icon: '⭐' },
  { min: 1001, max: Infinity, name: 'خبير', icon: '👑' },
]

interface ProfileXpBarProps {
  xp: {
    level: number
    name: string
    points: number
    progress: number
  }
}

export function ProfileXpBar({ xp }: ProfileXpBarProps) {
  const currentLevel = XP_LEVELS[xp.level - 1] || XP_LEVELS[0]
  const nextLevel = XP_LEVELS[xp.level] || null
  const pointsInLevel = xp.points - (currentLevel?.min || 0)
  const pointsNeeded = nextLevel ? nextLevel.min - (currentLevel?.min || 0) : 100

  return (
    <div className="rounded-lg bg-[#1a1a1a] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
          <Star className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">المستوى {xp.level} — {xp.name}</h3>
          <p className="text-sm text-gray-400">{xp.points} نقطة خبرة</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{pointsInLevel} / {pointsNeeded} XP</span>
          <span>{xp.progress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#222]">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${xp.progress}%` }}
          />
        </div>
      </div>

      {/* Level breakdown */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {XP_LEVELS.map((level, i) => (
          <div
            key={level.name}
            className={`rounded-lg p-2 text-center text-[10px] ${
              i + 1 <= xp.level ? 'bg-[#222]' : 'bg-[#181818] opacity-40'
            }`}
          >
            <div className="text-lg">{level.icon}</div>
            <div className="mt-1 text-gray-400">{level.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
