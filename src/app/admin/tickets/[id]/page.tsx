'use client'

import { ArrowRight, Loader2, Send } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  waiting: 'بانتظار الرد',
  resolved: 'محلولة',
  closed: 'مغلقة',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  waiting: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
}

interface TicketMessage {
  id: string
  content: string
  isInternal: boolean
  user: { id: string; username: string; avatarUrl: string | null }
  createdAt: string
}

interface TicketDetail {
  id: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  user: { id: string; username: string; avatarUrl: string | null }
  assignedUser: { id: string; username: string; avatarUrl: string | null } | null
  tags: { tag: string }[]
  messages: TicketMessage[]
  createdAt: string
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [sending, setSending] = useState(false)

  const fetchTicket = async () => {
    try {
      const response = await fetch(`/api/admin/tickets/${id}`)
      const data = await response.json()
      setTicket(data)
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTicket()
  }, [id])

  const handleReply = async () => {
    if (!replyContent.trim()) return
    setSending(true)
    try {
      await fetch(`/api/admin/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          isInternal,
          userId: ticket?.user.id,
          newStatus: newStatus || undefined,
        }),
      })
      setReplyContent('')
      setNewStatus('')
      fetchTicket()
    } catch (error) {
      console.error('Failed to send reply:', error)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      await fetch(`/api/admin/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchTicket()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
  if (!ticket)
    return <div className="p-8 text-center text-muted-foreground">التذكرة غير موجودة</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-mono">#{ticket.id.slice(-6)}</span>
            <span>•</span>
            <span>{new Date(ticket.createdAt).toLocaleString('ar-SA')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-4">
          {ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-lg border ${
                msg.isInternal
                  ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                  {msg.user.username[0]}
                </div>
                <span className="font-medium text-sm">{msg.user.username}</span>
                {msg.isInternal && (
                  <Badge variant="outline" className="text-xs">
                    ملاحظة داخلية
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground mr-auto">
                  {new Date(msg.createdAt).toLocaleString('ar-SA')}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}

          {/* Reply Form */}
          <div className="p-4 rounded-lg border space-y-3">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="اكتب ردك..."
              className="min-h-[100px]"
              dir="rtl"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded"
                />
                ملاحظة داخلية
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="">بدون تغيير الحالة</option>
                <option value="open">مفتوحة</option>
                <option value="in_progress">قيد المعالجة</option>
                <option value="waiting">بانتظار الرد</option>
                <option value="resolved">محلولة</option>
                <option value="closed">مغلقة</option>
              </select>
              <Button
                onClick={handleReply}
                disabled={!replyContent.trim() || sending}
                className="mr-auto"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg border space-y-3">
            <h3 className="font-medium">التفاصيل</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الحالة</span>
                <Badge className={STATUS_COLORS[ticket.status]}>
                  {STATUS_LABELS[ticket.status]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الأولوية</span>
                <span>{PRIORITY_LABELS[ticket.priority]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">التصنيف</span>
                <span>{ticket.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المستخدم</span>
                <span>{ticket.user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المسند</span>
                <span>{ticket.assignedUser?.username || '—'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border space-y-2">
            <h3 className="font-medium">تغيير الحالة</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={ticket.status === key ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => handleStatusChange(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {ticket.tags.length > 0 && (
            <div className="p-4 rounded-lg border space-y-2">
              <h3 className="font-medium">الوسوم</h3>
              <div className="flex flex-wrap gap-1">
                {ticket.tags.map((t) => (
                  <Badge key={t.tag} variant="secondary">
                    {t.tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
