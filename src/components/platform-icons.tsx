// Platform brand icons as inline SVGs.
// These use simple paths so they render as monochrome icons that inherit
// the parent's text color (like the real NexusMods site).

interface IconProps {
  className?: string
  width?: number | string
  height?: number | string
  color?: string
}

export function SteamIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.04 2 11.05l5.5 2.28c.47-.32 1.04-.51 1.65-.51h.15l2.45-3.55v-.05c0-2.02 1.65-3.66 3.67-3.66s3.67 1.64 3.67 3.66c0 2.02-1.65 3.66-3.67 3.66h-.08l-3.49 2.49v.12c0 1.42-1.16 2.58-2.58 2.58-1.24 0-2.28-.88-2.52-2.05L2.5 14.7C3.86 19.03 7.55 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-3.95 16.65l-2.3-.95c.41.85 1.12 1.55 2.05 1.93 1.65.67 3.53-.13 4.2-1.78.33-.8.32-1.68-.01-2.48-.33-.8-.94-1.42-1.74-1.75-.82-.34-1.7-.31-2.47-.01l2.38.99c1.22.5 1.8 1.9 1.3 3.12-.5 1.22-1.9 1.8-3.12 1.3zm9.31-7.91c0-1.35-1.1-2.45-2.45-2.45s-2.45 1.1-2.45 2.45 1.1 2.45 2.45 2.45 2.45-1.1 2.45-2.45zm-4.28 0c0-1.02.82-1.84 1.84-1.84s1.84.82 1.84 1.84-.82 1.84-1.84 1.84-1.84-.82-1.84-1.84z"/>
    </svg>
  )
}

export function GogIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 5.5v3.2c0 .8.6 1.4 1.4 1.4h.7c.8 0 1.4-.6 1.4-1.4V8.5h-.9v3.1c0 .3-.2.5-.5.5h-.7c-.3 0-.5-.2-.5-.5V8.5h-.9zm6.3 0v5h.9v-1.6h.8c.8 0 1.4-.6 1.4-1.4v-.6c0-.8-.6-1.4-1.4-1.4h-1.7zm.9.8h.7c.3 0 .5.2.5.5v.5c0 .3-.2.5-.5.5h-.7V9.3zm3.3-.8v5h2.6v-.8h-1.7V8.5h-.9z"/>
    </svg>
  )
}

export function EpicIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 3h16a2 2 0 0 1 2 2v11.5l-7.2 4.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.5 4v8.5h4.2v-1.4h-2.6V7h-1.6zm5.8 0v8.5h1.6V11h2v-1.4h-2V8.4h2.3V7h-3.9z"/>
    </svg>
  )
}

export function XboxIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.2 3.6c1.4 1.1 2.4 2.7 2.7 4.5-.7-.2-2.3-.6-4.1-.6-.3 0-.6 0-.9.1-.6-1.2-1.3-2.3-1.9-3.2 1.4-.4 2.8-.7 4.2-.8zM12 4.2c.5 0 1.6.3 3.1 2.8.5.8 1 1.7 1.4 2.6-1.4.4-2.9.9-4.5 1.6-1.6-.7-3.1-1.2-4.5-1.6.4-.9.9-1.8 1.4-2.6C10.4 4.5 11.5 4.2 12 4.2zM6.8 5.6c1.4.1 2.8.4 4.2.8-.6.9-1.3 2-1.9 3.2-.3-.1-.6-.1-.9-.1-1.8 0-3.4.4-4.1.6.3-1.8 1.3-3.4 2.7-4.5zM4.2 12c0-.1 1.9-.7 4.3-.7.2 0 .4 0 .6.1-.4 1.1-.7 2.2-.9 3.3-1.4-.5-2.5-1.2-3.4-2-.4-.3-.6-.6-.6-.7zm5.5 7.4c-1.8-.6-3.4-1.9-4.3-3.6.8.4 1.7.8 2.7 1.1.6.2 1.3.4 2 .5-.1.7-.2 1.4-.4 2zm.5-3.8c-1.1-.2-2.1-.5-3-1 .2-1.4.6-2.8 1.1-4.2 1.5.4 3.1 1 4.7 1.8-.9 1.2-1.8 2.4-2.8 3.4zm1.8 4c.1-.7.2-1.5.3-2.3.6-.7 1.3-1.5 1.9-2.4 1.5.7 2.9 1.5 4.1 2.3-1.6 1.5-3.8 2.4-6.3 2.4zm3.4-6.2c.6-1 1.2-2 1.7-3 1.3.7 2.4 1.5 3.2 2.3-.3 1.9-1.3 3.6-2.8 4.8-1.1-.8-2.5-1.6-4-2.3.6-.6 1.3-1.2 1.9-1.8z"/>
    </svg>
  )
}

export function PlayStationIcon({ className, width = 16, height = 16, color }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill={color || 'currentColor'} aria-hidden="true">
      <path d="M9.5 3v13.7l3.6 1.1V7.4c0-.7.3-1.2.9-1s1 .8 1 1.6v3.7c2.3 1.1 4.1.1 4.1-2.9 0-3.1-1.1-4.4-4.3-5.5-1.3-.4-3.5-.9-5.3-1.3zM7.9 18.6l-2.3-.7c-.6-.2-1-.7-1-1.3 0-.5.4-.8.9-.6l2.4.8v1.8zm1.6-1.2V19l5.3 1.7c.6.2 1 .6 1 1.2 0 .5-.4.8-.9.6l-5.4-1.8v1.8l6.3 2c1.7.5 3.1-.2 3.1-1.8 0-1.5-1-2.4-3.1-3l-6.3-2.1z"/>
    </svg>
  )
}

export function EaIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.5 4H7.1L3 11.3 7.1 20h9.4l4.1-7-4.1-9zM9.2 8.6h5.8l-1.4 2.4H7.8l1.4-2.4zm-1.8 3.1h5.8L9.2 16.8l-1.8-5.1zm7.3 5.1l-1.8-5.1 1.4-2.4 3.5 6.1h-3.1l-.0 1.4z"/>
    </svg>
  )
}

export function NintendoSwitchIcon({ className, width = 16, height = 16, color }: IconProps) {
  // Nintendo Switch logo — two joy-cons separated by a thin gap (left red, right blue),
  // simplified here as a monochrome silhouette.
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill={color || 'currentColor'} aria-hidden="true">
      <path d="M6.5 2h-1A3.5 3.5 0 0 0 2 5.5v13A3.5 3.5 0 0 0 5.5 22h1A1.5 1.5 0 0 0 8 20.5v-17A1.5 1.5 0 0 0 6.5 2zM5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM18.5 2h-1A1.5 1.5 0 0 0 16 3.5v17a1.5 1.5 0 0 0 1.5 1.5h1A3.5 3.5 0 0 0 22 18.5v-13A3.5 3.5 0 0 0 18.5 2zM17 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
    </svg>
  )
}

export function PcIcon({ className, width = 16, height = 16, color }: IconProps) {
  // PC / Desktop computer icon — monitor with stand and base
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill={color || 'currentColor'} aria-hidden="true">
      <path d="M21 2H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6v2H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-1v-2h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm0 13H3V3h18v12zM7 15h10V5H7v10z"/>
    </svg>
  )
}

export function Xbox360Icon({ className, width = 16, height = 16, color }: IconProps) {
  // Xbox 360 logo — the classic Xbox "X" sphere logo
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} className={className} fill={color || 'currentColor'} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.2c5.08 0 9.2 4.12 9.2 9.2s-4.12 9.2-9.2 9.2-9.2-4.12-9.2-9.2S6.92 3.2 12 3.2zM8.4 8.8l1.8 3.6-1.8 3.6h2.4l1.8-3.6 1.8 3.6h2.4l-1.8-3.6 1.8-3.6h-2.4l-1.8 3.6-1.8-3.6H8.4zm4.8 2.4l1.2 2.4-1.2 2.4h-1.2l-1.2-2.4 1.2-2.4h1.2z"/>
    </svg>
  )
}
