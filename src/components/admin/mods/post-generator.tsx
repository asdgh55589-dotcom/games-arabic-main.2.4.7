'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Send, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PostGeneratorProps {
  modId: string
  modName: string
}

interface GeneratedPost {
  post: string
  variables: Record<string, string>
  validation: { valid: boolean; length: number; remaining: number; warning: boolean }
}

export function PostGenerator({ modId, modName }: PostGeneratorProps) {
  const [post, setPost] = useState<GeneratedPost | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    generatePost()
  }, [modId])

  const generatePost = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${modId}/generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.data) {
        setPost(data.data)
        setEditContent(data.data.post)
      }
    } catch (err) {
      console.error('Failed to generate post:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    const text = isEditing ? editContent : post?.post || ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      // Send via generate-post endpoint which will trigger Telegram
      const res = await fetch(`/api/admin/mods/${modId}/generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendToTelegram: true }),
      })
      const data = await res.json()
      if (data.data?.sent) {
        alert('تم الإرسال بنجاح!')
      } else {
        alert(data.error || 'فشل الإرسال')
      }
    } catch (err) {
      alert('فشل الإرسال')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">منشور Telegram</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 min-h-[44px]">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !post?.validation.valid}
            className="gap-1.5 min-h-[44px]"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            إرسال
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Character counter */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{post?.validation.length || 0} / 4096 حرف</span>
          {post?.validation.warning && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              يقترب من الحد
            </span>
          )}
          {!post?.validation.valid && <span className="text-red-600">تجاوز الحد المسموح</span>}
        </div>

        {/* Telegram-style preview */}
        <div className="rounded-lg border bg-[#2b2d42] p-4 text-sm text-white whitespace-pre-wrap font-mono leading-relaxed">
          {isEditing ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] border-0 bg-transparent text-white focus-visible:ring-0"
              dir="rtl"
            />
          ) : (
            post?.post || 'اضغط "توليد" لإنشاء المنشور'
          )}
        </div>

        {/* Variables preview */}
        {post?.variables && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="font-medium text-muted-foreground mb-2">المتغيرات:</div>
            {Object.entries(post.variables)
              .slice(0, 6)
              .map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-primary font-mono">{`{${key}}`}</span>
                  <span className="text-muted-foreground truncate">{value}</span>
                </div>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'معاينة' : 'تعديل'}
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={generatePost}>
            إعادة التوليد
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
