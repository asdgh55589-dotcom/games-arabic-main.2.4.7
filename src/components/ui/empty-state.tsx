'use client'

import { Bell, FileText, Heart, Inbox, Search, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: 'inbox' | 'search' | 'file' | 'users' | 'bell' | 'heart'
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

const ICONS = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  users: Users,
  bell: Bell,
  heart: Heart,
}

export function EmptyState({ icon = 'inbox', title, description, action }: EmptyStateProps) {
  const Icon = ICONS[icon]
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className="text-primary hover:underline">
            {action.label}
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        ))}
    </div>
  )
}
