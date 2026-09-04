'use client'

import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartWrapperProps {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string
  action?: ReactNode
  children: ReactNode
}

export function ChartWrapper({
  title,
  subtitle,
  loading,
  error,
  action,
  children,
}: ChartWrapperProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent dir="rtl">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
