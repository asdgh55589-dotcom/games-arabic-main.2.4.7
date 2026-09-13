'use client'

import {
  AlertCircle,
  AlertTriangle,
  Award,
  Bell,
  CheckCheck,
  ChevronLeft,
  Clock,
  FileText,
  Heart,
  MessageCircle,
  Package,
  Send,
  Shield,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatArabicDate } from '@/lib/format'
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@/lib/notifications/types'
import type { Notification } from '@/lib/types'

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  [NotificationType.CommentReply]: <MessageCircle className="h-5 w-5 text-blue-400" />,
  [NotificationType.Like]: <Heart className="h-5 w-5 text-red-400" />,
  [NotificationType.ModEndorse]: <Heart className="h-5 w-5 text-red-400" />,
  [NotificationType.ModEndorseMilestone]: <Star className="h-5 w-5 text-amber-400" />,
  [NotificationType.ModFeatured]: <Star className="h-5 w-5 text-amber-400" />,
  [NotificationType.AdminAction]: <Shield className="h-5 w-5 text-purple-400" />,
  [NotificationType.AdminUserRegister]: <Users className="h-5 w-5 text-green-400" />,
  [NotificationType.AdminRequest]: <FileText className="h-5 w-5 text-cyan-400" />,
  [NotificationType.AdminReport]: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  [NotificationType.TierUpgrade]: <Award className="h-5 w-5 text-orange-400" />,
  [NotificationType.SpecialRoleAssigned]: <Shield className="h-5 w-5 text-purple-400" />,
  [NotificationType.SpecialRoleRemoved]: <Shield className="h-5 w-5 text-gray-400" />,
  [NotificationType.AdminMilestone]: <Star className="h-5 w-5 text-amber-400" />,
  [NotificationType.ModSubmitted]: <Send className="h-5 w-5 text-blue-400" />,
  [NotificationType.ModApproved]: <CheckCheck className="h-5 w-5 text-green-400" />,
  [NotificationType.ModRejected]: <AlertCircle className="h-5 w-5 text-red-400" />,
  [NotificationType.ModPublished]: <Package className="h-5 w-5 text-green-400" />,
  [NotificationType.ModScheduled]: <Clock className="h-5 w-5 text-blue-400" />,
  [NotificationType.NewComment]: <MessageCircle className="h-5 w-5 text-blue-400" />,
  [NotificationType.NewReport]: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  [NotificationType.NewVersion]: <Package className="h-5 w-5 text-cyan-400" />,
  [NotificationType.BackupCompleted]: <CheckCheck className="h-5 w-5 text-green-400" />,
  [NotificationType.SystemAlert]: <AlertTriangle className="h-5 w-5 text-red-400" />,
}

export function NotificationsPage() {
  useDocumentTitle('الإشعارات')
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState('all')

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter !== 'all') params.set('read', 'false')
      const res = await fetch(`/api/notifications?${params}`)
      if (res.ok) {
        const responseData = await res.json()
        setNotifications(responseData.data || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
        setUnreadCount(responseData.meta?.unreadCount || 0)
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notifications
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notifications
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await markAsRead(notification.id)
    }
    const url = (notification as any).targetUrl || notification.link
    if (url) {
      router.push(url)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' })
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notifications
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notifications
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="mx-auto max-w-[800px] px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-gold" />
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border text-xs text-muted-foreground hover:bg-accent min-h-[44px]"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              تعيين الكل كمقروء
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
        >
          <TabsList className="mb-6 w-full flex-row justify-start border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground data-[state=active]:border-gold data-[state=active]:text-foreground"
            >
              الكل
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground data-[state=active]:border-gold data-[state=active]:text-foreground"
            >
              غير مقروء ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon="bell"
                title="لا توجد إشعارات"
                description="ستظهر إشعاراتك هنا عندما تتلقى تفاعلات جديدة"
              />
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const targetUrl = (notification as any).targetUrl || notification.link
                  const targetTitle = (notification as any).targetTitle
                  const targetType = (notification as any).targetType
                  const actorUsername =
                    (notification as any).actorUsername || notification.actor?.username
                  const actorAvatarUrl =
                    (notification as any).actorAvatarUrl || notification.actor?.avatarUrl
                  const isClickable = !!targetUrl
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group flex gap-4 rounded-none border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                        !notification.readAt ? 'border-gold/20 bg-gold/5' : 'border-border bg-card'
                      }`}
                    >
                      {/* Avatar or Icon — clickable */}
                      <div className="shrink-0">
                        {actorUsername ? (
                          <Link
                            href={`/profile/${actorUsername}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block"
                          >
                            <Avatar className="h-11 w-11">
                              <AvatarImage src={actorAvatarUrl || undefined} />
                              <AvatarFallback className="bg-secondary text-sm font-bold text-gold">
                                {actorUsername[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                        ) : notification.actor ? (
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={notification.actor.avatarUrl || undefined} />
                            <AvatarFallback className="bg-secondary text-sm font-bold text-gold">
                              {notification.actor.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : targetType === 'team' ? (
                          <Link
                            href={targetUrl || '#'}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100"
                          >
                            <Users className="h-6 w-6 text-blue-600" />
                          </Link>
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
                            {TYPE_ICONS[notification.type as NotificationType] || (
                              <Bell className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-snug ${!notification.readAt ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                          >
                            {notification.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            {isClickable && <ChevronLeft className="w-4 h-4 text-gray-400" />}
                            {!notification.readAt && (
                              <div className="h-2 w-2 rounded-full bg-gold" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive min-h-[44px]"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {notification.message && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {actorUsername && (
                              <Link
                                href={`/profile/${actorUsername}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold hover:underline hover:text-gold"
                              >
                                {actorUsername}
                              </Link>
                            )}{' '}
                            {notification.message}
                          </p>
                        )}
                        {targetUrl && targetTitle && (
                          <Link
                            href={targetUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:underline"
                          >
                            <span>
                              {targetType === 'team'
                                ? '👥'
                                : targetType === 'profile'
                                  ? '👤'
                                  : '📄'}
                            </span>
                            <span className={targetType === 'team' ? 'font-bold' : ''}>
                              {targetTitle}
                            </span>
                          </Link>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                            {TYPE_ICONS[notification.type as NotificationType]}
                            {NOTIFICATION_TYPE_LABELS[notification.type as NotificationType] ||
                              notification.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60">
                            {formatArabicDate(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border text-xs text-muted-foreground min-h-[44px]"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  السابق
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border text-xs text-muted-foreground min-h-[44px]"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
