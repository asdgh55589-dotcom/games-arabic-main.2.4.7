'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDocumentTitle } from '@/hooks/use-document-title'

export default function NewTicketPage() {
  useDocumentTitle('تذكرة جديدة')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'question',
    priority: 'medium',
    tags: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
          userId: 'admin', // Default to admin for now
        }),
      })
      if (response.ok) {
        const ticket = await response.json()
        router.push(`/admin/tickets/${ticket.id}`)
      }
    } catch (error) {
      console.error('Failed to create ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">تذكرة جديدة</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-lg border">
        <div className="space-y-2">
          <Label>الموضوع *</Label>
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="عنوان التذكرة"
            required
            dir="rtl"
          />
        </div>

        <div className="space-y-2">
          <Label>الوصف *</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="وصف المشكلة أو الطلب..."
            className="min-h-[150px]"
            required
            dir="rtl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>التصنيف *</Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            >
              <option value="bug">خلل</option>
              <option value="feature">ميزة</option>
              <option value="question">سؤال</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>الأولوية</Label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>الوسوم (مفصولة بفاصلة)</Label>
          <Input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="وسم1, وسم2"
            dir="rtl"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={loading || !form.subject || !form.description}>
            {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            إنشاء التذكرة
          </Button>
          <Link href="/admin/tickets">
            <Button variant="outline" type="button">إلغاء</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
