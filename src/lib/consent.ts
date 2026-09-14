const CONSENT_KEY = 'analytics_consent' as const

export function getConsent(): 'granted' | 'denied' {
  if (typeof window === 'undefined') return 'granted'
  return (localStorage.getItem(CONSENT_KEY) as 'granted' | 'denied') || 'granted'
}

export function setConsent(consent: 'granted' | 'denied'): void {
  localStorage.setItem(CONSENT_KEY, consent)
}

export function isTrackingAllowed(): boolean {
  return getConsent() === 'granted'
}
