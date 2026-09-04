'use client'

import { Send, Star } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RatingDisplay } from './rating-display'

interface RatingFormProps {
  modId: string
  userId?: string
  existingRating?: { rating: number; comment?: string }
  onRatingSubmitted?: () => void
}

export function RatingForm({ modId, userId, existingRating, onRatingSubmitted }: RatingFormProps) {
  const [rating, setRating] = useState(existingRating?.rating || 0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState(existingRating?.comment || '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!userId || rating === 0) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/mods/${modId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rating, comment }),
      })
      if (response.ok) {
        setSubmitted(true)
        onRatingSubmitted?.()
      }
    } catch (error) {
      console.error('Rating submission failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!userId) return
    setSubmitting(true)
    try {
      await fetch(`/api/admin/mods/${modId}/ratings?userId=${userId}`, {
        method: 'DELETE',
      })
      setRating(0)
      setComment('')
      setSubmitted(false)
    } catch (error) {
      console.error('Rating deletion failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!userId) {
    return <div className="text-sm text-muted-foreground">سجّل الدخول لتقييم هذا التعريب</div>
  }

  if (submitted && existingRating) {
    return (
      <div className="space-y-3">
        <RatingDisplay rating={rating} showCount={false} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setSubmitted(false)}
          >
            تعديل التقييم
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="min-h-[44px]"
            onClick={handleDelete}
            disabled={submitting}
          >
            حذف التقييم
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setRating(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (hoveredStar || rating)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-muted-foreground/30 fill-muted-foreground/30'
              }`}
              fill="currentColor"
            />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="تعليق اختياري..."
        className="min-h-[80px] text-sm"
        dir="rtl"
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          className="min-h-[44px]"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          <Send className="h-4 w-4 ml-2" />
          {submitting ? 'جاري الإرسال...' : existingRating ? 'تحديث' : 'إرسال'}
        </Button>
        {existingRating && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setSubmitted(true)}
          >
            إلغاء
          </Button>
        )}
      </div>
    </div>
  )
}
