'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface LeaveTeamButtonProps {
  teamId: string
  teamName: string
  isOwner: boolean
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function LeaveTeamButton({
  teamId,
  teamName,
  isOwner,
  size = 'default',
}: LeaveTeamButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLeave = async () => {
    if (isOwner) {
      toast.error('لا يمكنك مغادرة الفريق لأنك المالك. قم بنقل الملكية أولاً.')
      return
    }

    if (
      !confirm(
        `هل أنت متأكد من مغادرة فريق "${teamName}"؟\n\nسيبقى اسمك وصورتك محفوظين كعضو وهمي في الفريق.`,
      )
    ) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/leave`, {
        method: 'POST',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg =
          data?.error?.message || data?.error?.details || data?.error || 'فشل مغادرة الفريق'
        throw new Error(typeof msg === 'string' ? msg : 'فشل مغادرة الفريق')
      }

      toast.success('تم مغادرة الفريق بنجاح')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل مغادرة الفريق'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isOwner) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        title="لا يمكنك المغادرة لأنك المالك — قم بنقل الملكية أولاً"
        className="min-h-[44px]"
      >
        <LogOut className="h-4 w-4 ml-1" />
        مغادرة
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleLeave}
      disabled={isLoading}
      className="min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 ml-1 animate-spin" />
          جاري المغادرة...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4 ml-1" />
          مغادرة الفريق
        </>
      )}
    </Button>
  )
}
