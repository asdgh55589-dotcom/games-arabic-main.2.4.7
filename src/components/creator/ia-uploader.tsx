'use client'

import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import ar_SA from '@uppy/locales/lib/ar_SA'
import en_US from '@uppy/locales/lib/en_US'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'
import * as React from 'react'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { parseUppyErrorEnvelope } from '@/lib/uppy-envelope'

export interface IaUploadedFile {
  /** Final archive.org download URL to store in the mod row. */
  url: string
  key: string
  bytes: number
  name: string
}

interface IaUploaderProps {
  modId?: string
  modSlug?: string
  title?: string
  maxFileSize?: number
  maxNumberOfFiles?: number
  /** 'direct' = browser→IA presigned PUT (full bandwidth). 'relay' = via server stream (IA CORS fallback). */
  mode?: 'direct' | 'relay'
  onComplete: (files: IaUploadedFile[]) => void
  onError?: (message: string) => void
}

const ARCHIVE_TYPES = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso']
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface SignResponse {
  uploadUrl: string
  downloadUrl: string
  key: string
  headers: Record<string, string>
}

/**
 * Internet Archive file uploader — Uppy Dashboard ONLY for progress/
 * pause/resume/retry (no custom progress code). Bytes stream direct to
 * IA via server-signed PUTs; keys never reach the browser.
 */
export function IaUploader({
  modId,
  modSlug,
  title,
  maxFileSize,
  maxNumberOfFiles = 3,
  mode = 'direct',
  onComplete,
  onError,
}: IaUploaderProps) {
  const { dict, locale } = useStudioLanguage()
  const targetRef = React.useRef<HTMLDivElement>(null)
  const callbacksRef = React.useRef({ onComplete, onError })
  callbacksRef.current = { onComplete, onError }
  const propsRef = React.useRef({ modId, modSlug, title, mode })
  propsRef.current = { modId, modSlug, title, mode }

  React.useEffect(() => {
    const pending = new Map<string, Promise<IaUploadedFile | null>>()

    const uppy = new Uppy({
      autoProceed: false,
      locale: locale === 'ar' ? ar_SA : en_US,
      restrictions: {
        maxFileSize: maxFileSize ?? undefined,
        maxNumberOfFiles,
        allowedFileTypes: ARCHIVE_TYPES,
      },
    })

    uppy.use(Dashboard, {
      target: targetRef.current as HTMLElement,
      inline: true,
      height: 320,
      width: '100%',
      hideProgressDetails: false,
      proudlyDisplayPoweredByUppy: false,
      doneButtonHandler: () => {
        uppy.clear()
      },
    })

    // Base XHR opts — per-file endpoint/headers set by the preprocessor.
    uppy.use(XHRUpload, {
      endpoint: '/api/storage/ia/relay',
      method: mode === 'direct' ? 'PUT' : 'POST',
      formData: mode !== 'direct',
      fieldName: 'file',
      bundle: false,
      allowedMetaFields: false,
      timeout: TWO_HOURS_MS,
      limit: 2,
      getResponseData: () => ({}),
    })

    // Sanctioned pre-upload hook: sign each file (direct) or attach relay
    // headers — runs after user presses Upload, before any byte moves.
    uppy.addPreProcessor(async (fileIDs: string[]) => {
      const { modId: mid, modSlug: slug, title: t, mode: m } = propsRef.current
      await Promise.all(
        fileIDs.map(async (id) => {
          const file = uppy.getFile(id)
          if (!file || (file.meta as Record<string, unknown>).iaReady) return
          if (m === 'relay') {
            uppy.setFileState(id, {
              xhrUpload: {
                endpoint: '/api/storage/ia/relay',
                method: 'POST',
                formData: false,
                headers: {
                  'Content-Type': 'application/octet-stream',
                  'x-ia-filename': encodeURIComponent(file.name || 'file'),
                  'x-ia-mime': file.type || 'application/octet-stream',
                  'x-ia-modslug': slug || 'mod',
                  'x-ia-title': (t || file.name || 'mod').slice(0, 200),
                  'x-ia-bytes': String(file.size || 0),
                },
              } as never,
              meta: { ...file.meta, iaReady: true, iaMode: 'relay' },
            })
            return
          }
          const signRes = await fetch('/api/storage/ia/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mime: file.type || 'application/octet-stream',
              bytes: file.size,
              modSlug: slug || 'mod',
              title: t || file.name,
            }),
          })
          const signJson = await signRes.json().catch(() => null)
          if (!signRes.ok) {
            const msg =
              (typeof signJson?.error?.message === 'string' && signJson.error.message) ||
              dict.uploader.signFailed
            throw new Error(msg)
          }
          const signed = signJson?.data as SignResponse
          uppy.setFileState(id, {
            xhrUpload: {
              endpoint: signed.uploadUrl,
              method: 'PUT',
              formData: false,
              allowedMetaFields: false,
              headers: signed.headers,
              timeout: TWO_HOURS_MS,
            } as never,
            meta: {
              ...file.meta,
              iaReady: true,
              iaMode: 'direct',
              iaKey: signed.key,
              iaDownloadUrl: signed.downloadUrl,
            },
          })
        }),
      )
    })

    // Per-file verify+record AFTER bytes land (server HeadObject + quota).
    uppy.on('upload-success', (file, _response) => {
      if (!file) return
      const meta = (file.meta ?? {}) as Record<string, unknown>
      const body = (file.response?.body ?? {}) as Record<string, unknown>
      const p = (async (): Promise<IaUploadedFile | null> => {
        try {
          const completeRes = await fetch('/api/storage/ia/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              meta.iaMode === 'relay'
                ? {
                    key: typeof body.key === 'string' ? body.key : '',
                    downloadUrl: typeof body.downloadUrl === 'string' ? body.downloadUrl : '',
                    bytes: typeof body.bytes === 'number' ? body.bytes : file.size,
                    mime: file.type,
                    modId: propsRef.current.modId,
                    mode: 'relay',
                  }
                : {
                    key: meta.iaKey,
                    downloadUrl: meta.iaDownloadUrl,
                    bytes: file.size,
                    mime: file.type,
                    modId: propsRef.current.modId,
                    mode: 'direct',
                  },
            ),
          })
          const completeJson = await completeRes.json().catch(() => null)
          if (!completeRes.ok) {
            const msg =
              (typeof completeJson?.error?.message === 'string' && completeJson.error.message) ||
              dict.uploader.confirmFailed
            throw new Error(msg)
          }
          const data = completeJson?.data as { downloadUrl?: unknown; key?: unknown; bytes?: unknown }
          const url = typeof data?.downloadUrl === 'string' ? data.downloadUrl : ''
          if (!url.startsWith('https://')) throw new Error(dict.uploader.confirmFailed)
          return {
            url,
            key: typeof data?.key === 'string' ? data.key : String(meta.iaKey ?? ''),
            bytes: typeof data?.bytes === 'number' ? data.bytes : file.size || 0,
            name: file.name || '',
          }
        } catch (err) {
          callbacksRef.current.onError?.(err instanceof Error ? err.message : dict.uploader.confirmFailed)
          return null
        }
      })()
      pending.set(file.id, p)
    })

    uppy.on('complete', async () => {
      const settled = await Promise.all([...pending.values()])
      pending.clear()
      const files = settled.filter((f): f is IaUploadedFile => f !== null)
      if (files.length > 0) callbacksRef.current.onComplete(files)
    })

    uppy.on('upload-error', (_file, error, response) => {
      callbacksRef.current.onError?.(
        parseUppyErrorEnvelope(response) || error?.message || 'Upload failed',
      )
    })

    uppy.on('restriction-failed', (_file, error) => {
      callbacksRef.current.onError?.(error?.message || 'File rejected')
    })

    return () => {
      uppy.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, maxFileSize, maxNumberOfFiles])

  return <div ref={targetRef} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
}
