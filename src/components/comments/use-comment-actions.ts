'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

/** تعديل/حذف تعليق واحد (مستخرج من CommentCard) */
export function useCommentActions(commentId: string, initialText: string, onRefresh: () => void) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(initialText)
  const [saving, setSaving] = useState(false)

  const handleEdit = async () => {
    if (!editText.trim() || editText === initialText) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      })
      if (res.ok) {
        toast({ title: 'تم التعديل' })
        setIsEditing(false)
        onRefresh()
      } else {
        const data = await res.json()
        toast({
          title: 'خطأ',
          description: data.error?.message || 'فشل التعديل',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'تم الحذف' })
        onRefresh()
      } else {
        const data = await res.json()
        toast({
          title: 'خطأ',
          description: data.error?.message || 'فشل الحذف',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const requestDelete = () => setDeleteOpen(true)
  const confirmDelete = async () => {
    setDeleteOpen(false)
    await handleDelete()
  }

  const startEditing = (text: string) => {
    setIsEditing(true)
    setEditText(text)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditText(initialText)
  }

  return {
    isEditing,
    editText,
    setEditText,
    saving,
    handleEdit,
    handleDelete,
    deleteOpen,
    setDeleteOpen,
    requestDelete,
    confirmDelete,
    startEditing,
    cancelEditing,
  }
}
