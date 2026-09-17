import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { db } from '@/lib/db'
import { getIaClient, getIaConfig, parseIaUrl } from '@/lib/ia'
import { logger } from '@/lib/logger'

export interface FileDeleteResult {
  remoteDeleted: boolean
  unlinkedLinks: number
}

/**
 * Delete an uploaded file end-to-end (P1 file management):
 * 1. best-effort remote delete (IA S3 / FreeImage deleteUrl)
 * 2. unlink ModFileLink rows pointing at the same URL
 * 3. decrement CreatorStorage counters (floored at 0)
 * 4. hard-delete the UploadAsset row (no deletedAt column — schema change
 *    against the live DB was deliberately avoided; audit log keeps history)
 * 5. write an AuditLog entry (action=delete, entity=file)
 */
export async function deleteUploadAsset(
  asset: {
    id: string
    userId: string
    provider: string
    originalUrl: string
    storageKey: string | null
    bytes: bigint
  },
  actor: { id: string; username: string },
): Promise<FileDeleteResult> {
  let remoteDeleted = false

  // 1. Remote delete (best-effort — DB cleanup proceeds regardless).
  try {
    if (asset.provider === 'ia') {
      const cfg = getIaConfig()
      // storageKey format: `<identifier>/<key>` (see iaStorageKey).
      let key = asset.storageKey && asset.storageKey.includes('/')
        ? asset.storageKey.slice(asset.storageKey.indexOf('/') + 1)
        : null
      let identifier = cfg.identifier
      if (asset.storageKey && asset.storageKey.includes('/')) {
        identifier = asset.storageKey.slice(0, asset.storageKey.indexOf('/')) || identifier
      }
      if (!key) {
        const parsed = parseIaUrl(asset.originalUrl)
        if (parsed) {
          identifier = parsed.identifier
          key = parsed.key
        }
      }
      if (key) {
        await getIaClient().send(
          new DeleteObjectCommand({ Bucket: identifier, Key: key }),
        )
        remoteDeleted = true
      }
    } else if (asset.provider === 'freeimage' && asset.storageKey) {
      const res = await fetch(asset.storageKey, {
        method: 'DELETE',
        signal: AbortSignal.timeout(10_000),
      })
      remoteDeleted = res.ok || res.status === 404
    } else {
      // cloudinary/supabase/direct: no remote handle stored — DB-only.
      remoteDeleted = true
    }
  } catch (err) {
    logger.warn({ err, assetId: asset.id }, 'remote file delete failed (best-effort)')
  }

  // 2. Unlink mod file links pointing at the same URL.
  let unlinkedLinks = 0
  try {
    const del = await db.modFileLink.deleteMany({ where: { url: asset.originalUrl } })
    unlinkedLinks = del.count
  } catch (err) {
    logger.warn({ err, assetId: asset.id }, 'modFileLink unlink failed (best-effort)')
  }

  // 3+4. Quota decrement (floored at 0) + hard-delete, atomically.
  const bytes = asset.bytes > 0 ? asset.bytes : BigInt(0)
  await db.$transaction(async (tx) => {
    const storage = await tx.creatorStorage.findUnique({ where: { userId: asset.userId } })
    if (storage) {
      const total = storage.totalBytes - bytes
      const count = storage.filesCount - 1
      await tx.creatorStorage.update({
        where: { userId: asset.userId },
        data: {
          totalBytes: total > 0 ? total : BigInt(0),
          filesCount: count > 0 ? count : 0,
        },
      })
    }
    await tx.uploadAsset.delete({ where: { id: asset.id } })
  })

  // 5. Audit trail (best-effort).
  try {
    await db.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        action: 'delete',
        entity: 'file',
        entityId: asset.id,
        details: JSON.stringify({
          code: 'FILE_DELETED',
          provider: asset.provider,
          url: asset.originalUrl,
          remoteDeleted,
          unlinkedLinks,
        }),
      },
    })
  } catch (err) {
    logger.warn({ err, assetId: asset.id }, 'file delete audit failed (best-effort)')
  }

  return { remoteDeleted, unlinkedLinks }
}
