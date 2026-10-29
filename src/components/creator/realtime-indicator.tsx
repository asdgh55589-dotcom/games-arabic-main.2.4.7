'use client'

import { RefreshCw } from 'lucide-react'
import { useRealtimeSync } from '@/hooks/use-realtime-sync'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface RealtimeIndicatorProps {
  userId?: string | null
  enabled?: boolean
  className?: string
}

export function RealtimeIndicator({
  userId,
  enabled = true,
  className,
}: RealtimeIndicatorProps) {
  const { isConnected, reconnect } = useRealtimeSync({ userId, enabled })

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)}>
            <span
              className={cn(
                'inline-block h-2.5 w-2.5 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500',
              )}
              aria-label={isConnected ? 'connected' : 'disconnected'}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => reconnect()}
              aria-label="reconnect"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isConnected ? 'متصل (real-time)' : 'غير متصل — انقر لإعادة الاتصال'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default RealtimeIndicator