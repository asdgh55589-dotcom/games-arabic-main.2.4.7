'use client'

import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

type Metric = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

function sendToAnalytics(metric: Metric) {
  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? 'green' : metric.rating === 'needs-improvement' ? 'orange' : 'red'
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    )
  }
  if (process.env.NODE_ENV === 'production') {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.rating,
        non_interaction: true,
      })
    }
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics)
  onLCP(sendToAnalytics)
  onFCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
  onINP(sendToAnalytics)
}
