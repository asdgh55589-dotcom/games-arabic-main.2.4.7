'use client'

import { Bell, Mail, MessageSquare, type LucideIcon, Send } from 'lucide-react'
import { isAdminChannel, type AdminChannel } from '@/lib/notifications/admin-labels'

/**
 * Channel → icon. The health page used to render a `Mail` glyph for every
 * channel, so an `in_app` failure looked like an email failure.
 *
 * `telegram` gets `Send` (the paper plane) rather than `MessageSquare`, which
 * `in_app` already owns — otherwise the two are indistinguishable at 12px.
 */
const CHANNEL_ICONS: Record<AdminChannel, LucideIcon> = {
  in_app: Bell,
  email: Mail,
  telegram: Send,
}

export function ChannelIcon({
  channel,
  className,
}: {
  channel: string
  className?: string
}) {
  const Icon = isAdminChannel(channel) ? CHANNEL_ICONS[channel] : MessageSquare
  return <Icon aria-hidden="true" className={className} />
}
