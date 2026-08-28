'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { TeamDetail } from '@/lib/types'
import type { TabKey } from '@/lib/team-constants'

export function useTeamDetail() {
  const params = useParams()
  const teamSlug = (params.slug as string) || ''
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  useDocumentTitle('فريق التعريب')

  const url = useMemo(() => {
    if (!teamSlug) return null
    return `/api/teams/${encodeURIComponent(teamSlug)}`
  }, [teamSlug])

  const { data, loading } = useFetch<{ data: { team: TeamDetail } }>(url, [url])
  const team = data?.data?.team

  return { team, loading, activeTab, setActiveTab }
}
