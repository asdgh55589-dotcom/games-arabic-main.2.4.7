'use client'

import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface NewVersionDialogProps {
  modId: string
  currentVersion: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

function incrementVersion(version: string, type: 'patch' | 'minor' | 'major' = 'patch'): string {
  const parts = version.split('.').map(Number)
  while (parts.length < 3) parts.push(0)

  if (type === 'major') {
    parts[0] += 1
    parts[1] = 0
    parts[2] = 0
  } else if (type === 'minor') {
    parts[1] += 1
    parts[2] = 0
  } else {
    parts[2] += 1
  }

  return parts.join('.')
}

export function NewVersionDialog({
  modId,
  currentVersion,
  open,
  onOpenChange,
  onCreated,
}: NewVersionDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(incrementVersion(currentVersion))
  const [changelog, setChangelog] = useState('')
  const [bumpType, setBumpType] = useState<'patch' | 'minor' | 'major'>('patch')

  const handleBumpTypeChange = (type: 'patch' | 'minor' | 'major') => {
    setBumpType(type)
    setVersion(incrementVersion(currentVersion, type))
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mods/${modId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, changelog }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل إنشاء الإصدار')
      }

      toast({ title: 'تم إنشاء الإصدار', description: `الإصدار ${version} تم إنشاؤه بنجاح` })
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إصدار جديد</DialogTitle>
          <DialogDescription>الإصدار الحالي: {currentVersion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {(['patch', 'minor', 'major'] as const).map((type) => (
              <Button
                key={type}
                variant={bumpType === type ? 'default' : 'outline'}
                size="sm"
                className="min-h-[44px]"
                onClick={() => handleBumpTypeChange(type)}
              >
                {type === 'patch'
                  ? 'تصحيح (patch)'
                  : type === 'minor'
                    ? 'ميزات (minor)'
                    : 'رئيسي (major)'}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="version">رقم الإصدار</Label>
            <Input
              id="version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">سجل التغييرات</Label>
            <Textarea
              id="changelog"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="ما الذي تغيّر في هذا الإصدار؟"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleCreate} disabled={loading || !version.trim()}>
            {loading ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="ml-1 h-4 w-4" />
            )}
            إنشاء الإصدار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
