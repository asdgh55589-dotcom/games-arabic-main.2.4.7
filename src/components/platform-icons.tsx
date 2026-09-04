// Platform brand icons as inline SVGs.
// These use simple paths so they render as monochrome icons that inherit
// the parent's text color (like the real NexusMods site).

interface IconProps {
  className?: string
  width?: number | string
  height?: number | string
  color?: string
}

export function PlayStationIcon({ className, width = 16, height = 16, color }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      className={className}
      fill={color || 'currentColor'}
      aria-hidden="true"
    >
      <path d="M9.5 3v13.7l3.6 1.1V7.4c0-.7.3-1.2.9-1s1 .8 1 1.6v3.7c2.3 1.1 4.1.1 4.1-2.9 0-3.1-1.1-4.4-4.3-5.5-1.3-.4-3.5-.9-5.3-1.3zM7.9 18.6l-2.3-.7c-.6-.2-1-.7-1-1.3 0-.5.4-.8.9-.6l2.4.8v1.8zm1.6-1.2V19l5.3 1.7c.6.2 1 .6 1 1.2 0 .5-.4.8-.9.6l-5.4-1.8v1.8l6.3 2c1.7.5 3.1-.2 3.1-1.8 0-1.5-1-2.4-3.1-3l-6.3-2.1z" />
    </svg>
  )
}

export function EaIcon({ className, width = 16, height = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.5 4H7.1L3 11.3 7.1 20h9.4l4.1-7-4.1-9zM9.2 8.6h5.8l-1.4 2.4H7.8l1.4-2.4zm-1.8 3.1h5.8L9.2 16.8l-1.8-5.1zm7.3 5.1l-1.8-5.1 1.4-2.4 3.5 6.1h-3.1l-.0 1.4z" />
    </svg>
  )
}

export function NintendoSwitchIcon({ className, width = 16, height = 16, color }: IconProps) {
  // Nintendo Switch logo — two joy-cons separated by a thin gap (left red, right blue),
  // simplified here as a monochrome silhouette.
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      className={className}
      fill={color || 'currentColor'}
      aria-hidden="true"
    >
      <path d="M6.5 2h-1A3.5 3.5 0 0 0 2 5.5v13A3.5 3.5 0 0 0 5.5 22h1A1.5 1.5 0 0 0 8 20.5v-17A1.5 1.5 0 0 0 6.5 2zM5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM18.5 2h-1A1.5 1.5 0 0 0 16 3.5v17a1.5 1.5 0 0 0 1.5 1.5h1A3.5 3.5 0 0 0 22 18.5v-13A3.5 3.5 0 0 0 18.5 2zM17 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
    </svg>
  )
}

export function PcIcon({ className, width = 16, height = 16, color }: IconProps) {
  // PC / Desktop computer icon — monitor with stand and base
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      className={className}
      fill={color || 'currentColor'}
      aria-hidden="true"
    >
      <path d="M21 2H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6v2H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-1v-2h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm0 13H3V3h18v12zM7 15h10V5H7v10z" />
    </svg>
  )
}

export function Xbox360Icon({ className, width = 16, height = 16, color }: IconProps) {
  // Xbox 360 logo — the classic Xbox "X" sphere logo
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      className={className}
      fill={color || 'currentColor'}
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.2c5.08 0 9.2 4.12 9.2 9.2s-4.12 9.2-9.2 9.2-9.2-4.12-9.2-9.2S6.92 3.2 12 3.2zM8.4 8.8l1.8 3.6-1.8 3.6h2.4l1.8-3.6 1.8 3.6h2.4l-1.8-3.6 1.8-3.6h-2.4l-1.8 3.6-1.8-3.6H8.4zm4.8 2.4l1.2 2.4-1.2 2.4h-1.2l-1.2-2.4 1.2-2.4h1.2z" />
    </svg>
  )
}
