'use client'

import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import ar_SA from '@uppy/locales/lib/ar_SA'
import en_US from '@uppy/locales/lib/en_US'
import '@uppy/core/css/style.css'
import '@uppy/dashboard/css/style.css'
import * as React from 'react'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { parseUppyErrorEnvelope, parseUppySuccessEnvelope, pickStoredUrl } from '@/lib/uppy-envelope'

export interface UploadedFileInfo {
  /** Final https URL to store (wrappedUrl when provided, else original). */
  url: string
  originalUrl: string
  wrappedUrl?: string | null
  name: string
  size?: number
  mime?: string
}

interface UppyUploaderProps {
  /** Server route receiving multipart uploads (keys stay server-side). */
  endpoint: string
  /** Extra form fields sent with every file (type, modId, ...). */
  meta?: Record<string, string>
  allowedFileTypes?: string[]
  maxFileSize?: number
  maxNumberOfFiles?: number
  note?: string
  height?: number
  onComplete: (files: UploadedFileInfo[]) => void
  onError?: (message: string) => void
}

/**
 * Professional uploader — ALL progress/pause/resume/retry UI comes from
 * Uppy Dashboard. No hand-built progress code anywhere in this flow.
 * Code-split by parents via dynamic(ssr:false); this module (and the Uppy
 * vendor chunk) only loads when the uploader mounts.
 */
export function UppyUploader({
  endpoint,
  meta,
  allowedFileTypes,
  maxFileSize,
  maxNumberOfFiles = 10,
  note,
  height = 320,
  onComplete,
  onError,
}: UppyUploaderProps) {
  const { locale } = useStudioLanguage()
  const targetRef = React.useRef<HTMLDivElement>(null)
  const callbacksRef = React.useRef({ onComplete, onError })
  callbacksRef.current = { onComplete, onError }

  const metaKey = JSON.stringify(meta ?? {})
  const typesKey = (allowedFileTypes ?? []).join(',')

  React.useEffect(() => {
    const uppy = new Uppy({
      autoProceed: false,
      locale: locale === 'ar' ? ar_SA : en_US,
      meta: meta ? JSON.parse(metaKey) : undefined,
      restrictions: {
        maxFileSize: maxFileSize ?? undefined,
        maxNumberOfFiles,
        allowedFileTypes: typesKey ? typesKey.split(',') : undefined,
      },
    })

    uppy.use(Dashboard, {
      target: targetRef.current as HTMLElement,
      inline: true,
      height,
      width: '100%',
      hideProgressDetails: false,
      proudlyDisplayPoweredByUppy: false,
      note: note ?? undefined,
      doneButtonHandler: () => {
        uppy.clear()
      },
    })

    uppy.use(XHRUpload, {
      endpoint,
      formData: true,
      fieldName: 'file',
      bundle: false,
      // 5 concurrent files — saturates typical creator uplinks without
      // head-of-line blocking; per-file byte progress stays accurate.
      limit: 5,
      getResponseData: (xhr: XMLHttpRequest) => parseUppySuccessEnvelope(xhr.responseText),
    })

    uppy.on('complete', (result) => {
      const files: UploadedFileInfo[] = (result.successful ?? []).map((f) => {
        const body = (f.response?.body ?? {}) as Record<string, unknown>
        const original =
          typeof body.originalUrl === 'string'
            ? body.originalUrl
            : typeof body.url === 'string'
              ? body.url
              : ''
        const wrapped = typeof body.wrappedUrl === 'string' ? body.wrappedUrl : null
        return {
          url: pickStoredUrl(body),
          originalUrl: original,
          wrappedUrl: wrapped,
          name: f.name ?? '',
          size: f.size ?? undefined,
          mime: f.type ?? undefined,
        }
      }).filter((f) => f.url !== '')
      if (files.length > 0) callbacksRef.current.onComplete(files)
    })

    uppy.on('upload-error', (_file, error, response) => {
      // v6 has no getResponseError hook — the raw XHR arrives as 3rd arg,
      // so parse our { error: { message } } envelope (Arabic reasons).
      callbacksRef.current.onError?.(parseUppyErrorEnvelope(response) || error?.message || 'Upload failed')
    })

    uppy.on('restriction-failed', (_file, error) => {
      callbacksRef.current.onError?.(error?.message || 'File rejected')
    })

    return () => {
      uppy.destroy()
    }
    // Rebuilt when endpoint/meta/locale/limits change (fresh Dashboard copy).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, metaKey, typesKey, maxFileSize, maxNumberOfFiles, locale, height, note])

  return <div ref={targetRef} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
}
