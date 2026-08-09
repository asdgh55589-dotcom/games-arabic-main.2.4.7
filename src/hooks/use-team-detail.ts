'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { TeamDetail } from '@/lib/types'
import type { TabKey } from '@/lib/team-constants'

export function useTeamDetail() {
  const searchParams = useSearchParams()
  const teamSlug = searchParams.get('team') || ''
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  useDocumentTitle('فريق التعريب')

  const url = useMemo(() => {
    if (!teamSlug) return null
    return `/api/teams/${encodeURIComponent(teamSlug)}`
  }, [teamSlug])

  const { data, loading } = useFetch<{ team: TeamDetail }>(url, [url])
  const team = data?.team

  return { team, loading, activeTab, setActiveTab }
}
