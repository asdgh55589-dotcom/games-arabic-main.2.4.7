import { useCallback, useEffect, useState } from 'react'

export function useTabPersistence(defaultTab: string = 'overview', validTabs?: string[]) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && (!validTabs || validTabs.includes(hash))) {
      setActiveTab(hash)
    }
  }, [validTabs])

  const changeTab = useCallback((tab: string) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.location.hash = tab
    }
  }, [])

  return { activeTab, changeTab, setActiveTab }
}
