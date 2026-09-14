import * as Sentry from '@sentry/nextjs'
import { sentryBeforeSend } from './src/lib/sentry-filters'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: sentryBeforeSend,
})
