'use client'

import Link from 'next/link'
import { Edit3, MessageCircle, ThumbsUp, Download, Bell, Heart } from 'lucide-react'
import { formatArabicDate } from '@/lib/format'

interface ActivityItem {
  type: 'mod_edit' | 'comment' | 'endorsement' | 'download' | 'like' | 'notification'
  text: string
  modName?: string
  modSlug?: string
  createdAt: string
}

interface ProfileActivityFeedProps {
  activity: {
    modEdits?: { id: string; name: string; slug: string; updatedAt: string }[]
    comments?: { id: string; text: string; createdAt: string; mod: { name: string; slug: string } }[]
    endorsements?: { id: string; createdAt: string; mod: { name: string; slug: string } }[]
  }
  accent: string
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  mod_edit: <Edit3 className="h-4 w-4" />,
  comment: <MessageCircle className="h-4 w-4" />,
  endorsement: <ThumbsUp className="h-4 w-4" />,
  download: <Download className="h-4 w-4" />,
  like: <Heart className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
}

const ACTIVITY_COLORS: Record<string, string> = {
  mod_edit: '#3b82f6',
  comment: '#8b5cf6',
  endorsement: '#f59e0b',
  download: '#10b981',
  like: '#ef4444',
  notification: '#6366f1',
}

export function ProfileActivityFeed({ activity, accent }: ProfileActivityFeedProps) {
  const items: ActivityItem[] = []

  // Process mod edits
  activity.modEdits?.forEach(mod => {
    items.push({
      type: 'mod_edit',
      text: `عدّل تعريب "${mod.name}"`,
      modName: mod.name,
      modSlug: mod.slug,
      createdAt: mod.updatedAt,
    })
  })

  // Process comments
  activity.comments?.forEach(comment => {
    items.push({
      type: 'comment',
      text: `كتب تعليق على "${comment.mod.name}"`,
      modName: comment.mod.name,
      modSlug: comment.mod.slug,
      createdAt: comment.createdAt,
    })
  })

  // Process endorsements
  activity.endorsements?.forEach(endorsement => {
    items.push({
      type: 'endorsement',
      text: `أضاف تأييد على "${endorsement.mod.name}"`,
      modName: endorsement.mod.name,
      modSlug: endorsement.mod.slug,
      createdAt: endorsement.createdAt,
    })
  })

  // Sort by date (newest first)
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="mb-3 text-4xl text-gray-600">📝</div>
        <p className="text-sm text-gray-500">لا يوجد نشاط بعد</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <Link
          key={`${item.type}-${i}`}
          href={item.modSlug ? `/?view=mod&slug=${item.modSlug}` : '#'}
          className="block rounded-lg bg-[#1a1a1a] px-4 py-3 transition-colors hover:bg-[#222]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: ACTIVITY_COLORS[item.type] + '22', color: ACTIVITY_COLORS[item.type] }}
              >
                {ACTIVITY_ICONS[item.type]}
              </div>
              <div>
                <p className="text-sm text-gray-300">{item.text}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatArabicDate(item.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
