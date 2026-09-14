// PlatformSelector — Step 1 of the creator mod wizard.
// Shows 9 platform cards for the user to choose from.

'use client'

import {
  PlayStationIcon,
  NintendoSwitchIcon,
  PcIcon,
  Xbox360Icon,
} from '@/components/platform-icons'
import { PLATFORMS } from '@/lib/constants'
import { getPlatformColor } from '@/lib/constants/platforms'

interface PlatformSelectorProps {
  selected: string
  onSelect: (key: string) => void
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  PC: <PcIcon className="h-8 w-8" />,
  PS1: <PlayStationIcon className="h-8 w-8" />,
  PS2: <PlayStationIcon className="h-8 w-8" />,
  PS3: <PlayStationIcon className="h-8 w-8" />,
  PS4: <PlayStationIcon className="h-8 w-8" />,
  PS5: <PlayStationIcon className="h-8 w-8" />,
  NS: <NintendoSwitchIcon className="h-8 w-8" />,
  X360: <Xbox360Icon className="h-8 w-8" />,
  ANDROID: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
      <path d="M17.523 15.34a1 1 0 0 1-.99-1.14l.63-3.77a1 1 0 0 0-.34-.93l-2.12-1.84a.5.5 0 0 0-.65 0L12 9.16l-1.05-.91a.5.5 0 0 0-.65 0L8.19 10.09a1 1 0 0 0-.34.93l.63 3.77a1 1 0 0 1-.99 1.14H6a1 1 0 0 0-1 1v1.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V16.4a1 1 0 0 0-1-1h-.477zM8.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
    </svg>
  ),
}

export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">اختر منصة التعريب</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر المنصة التي ستعمل عليها قبل ملء باقي البيانات
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const color = getPlatformColor(p.key)
          const isSelected = selected === p.key

          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              className={`group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all hover:scale-[1.02] ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-card/50 hover:border-muted-foreground/30'
              }`}
            >
              {/* Platform icon */}
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? 'bg-primary/10' : 'bg-muted/50 group-hover:bg-muted'
                }`}
                style={isSelected ? { color } : undefined}
              >
                {PLATFORM_ICONS[p.key] || (
                  <span className="text-2xl font-bold" style={{ color }}>
                    {p.key}
                  </span>
                )}
              </span>

              {/* Platform name */}
              <span
                className={`text-sm font-bold ${
                  isSelected ? 'text-primary' : 'text-foreground'
                }`}
              >
                {p.arabicLabel}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
