import {
  Monitor,
  Gamepad2,
  Smartphone,
  Laptop,
  Tv,
  Headphones,
  Watch,
  Tablet,
  HardDrive,
  Disc,
  CircleDot,
  Square,
  Hexagon,
  type LucideIcon,
} from 'lucide-react'
import {
  PcIcon,
  NintendoSwitchIcon,
  PlayStationIcon,
  Xbox360Icon,
} from '@/components/platform-icons'

// Map icon name strings (from DB) to React components
const ICON_MAP: Record<
  string,
  | LucideIcon
  | React.ComponentType<{ className?: string; width?: number; height?: number; color?: string }>
> = {
  Monitor,
  Gamepad2,
  Smartphone,
  Laptop,
  Tv,
  Headphones,
  Watch,
  Tablet,
  HardDrive,
  Disc,
  CircleDot,
  Square,
  Hexagon,
  PcIcon,
  PlayStationIcon,
  NintendoSwitchIcon,
  Xbox360Icon,
}

export function getSectionIcon(iconName: string) {
  return ICON_MAP[iconName] || Monitor
}
