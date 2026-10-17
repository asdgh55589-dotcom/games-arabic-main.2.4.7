/**
 * lib/social/template-versions.ts — إصدارات قوالب المنشورات (Phase 5).
 *
 * على غرار NotificationTemplateVersion: كل إنشاء/حفظ يُنشئ لقطة غير قابلة
 * للتعديل (SocialPostTemplateVersion)، والتراجع يستعيد المحتوى عبر نسخة
 * جديدة (لا يمحو التاريخ أبداً).
 *
 * خصائص الخلود (الفئة 5):
 * - القالب المُنشأ حديثاً `isArchived=false` يظهر فوراً في كل منتقيات
 *   القوالب (v1 لقطة أولى تلقائياً).
 * - المحتوى لا يُقرأ من القالب وقت النشر — المنشور يحمّل محتواه بنفسه
 *   (لقطة وقت الجدولة/الحفظ)؛ لذا أرشفة القالب لا تعيق المنشورات المجدولة.
 */

import type { SocialPostTemplate } from '@prisma/client'
import { db } from '@/lib/db'

export interface TemplateVersionActor {
  id?: string | null
  username?: string | null
}

/** حقول المحتوى اللقطة عند كل حفظ (بدون حالة الأرشفة الافتراضية والمالك). */
export interface TemplateContentInput {
  name: string
  title?: string | null
  body: string
  parseMode?: string | null
  richDocument?: unknown
  mediaUrl?: string | null
  variables?: unknown
}

interface VersionableTemplate {
  id: string
  name: string
  title: string | null
  body: string
  parseMode: string | null
  richDocument: unknown
  mediaUrl: string | null
  variables: unknown
  isDefault: boolean
}

/** التسلسل: آخر إصدار + 1 (aggregate مران بديل للاعادات الذرية — التزامن هنا محدود). */
async function nextVersionNumber(templateId: string): Promise<number> {
  const latest = await db.socialPostTemplateVersion.aggregate({
    where: { templateId },
    _max: { version: true },
  })
  return (latest._max.version ?? 0) + 1
}

/** لقطة بلا قراءة للقالب (تُستخدم بعد إنشاء/تحديث الصف بالحقل المطلوب). */
export async function snapshotTemplateVersion(
  template: VersionableTemplate,
  actor: TemplateVersionActor = {},
  changeNote: string,
): Promise<number> {
  const version = await nextVersionNumber(template.id)
  await db.socialPostTemplateVersion.create({
    data: {
      templateId: template.id,
      version,
      changedBy: actor.id ?? null,
      changeNote,
      name: template.name,
      title: template.title,
      body: template.body,
      parseMode: template.parseMode,
      richDocument: (template.richDocument ?? undefined) as never,
      mediaUrl: template.mediaUrl,
      variables: (template.variables ?? []) as never,
    },
  })
  return version
}

/** إنشاء قالب جديد (الخلود: isArchived=false دائماً) مع لقطة v1. */
export async function createTemplateWithVersion(
  data: TemplateContentInput & { isDefault?: boolean; platform?: string; createdById?: string },
  actor: TemplateVersionActor = {},
): Promise<{ template: SocialPostTemplate; version: number }> {
  const created = await db.socialPostTemplate.create({
    data: {
      platform: data.platform ?? 'telegram',
      name: data.name,
      title: data.title ?? null,
      body: data.body,
      parseMode: data.parseMode ?? null,
      richDocument: (data.richDocument ?? undefined) as never,
      mediaUrl: data.mediaUrl ?? null,
      variables: (data.variables ?? []) as never,
      isDefault: false,
      // الخلود: إنشاء دائماً غير مؤرشف وإن أرسل العميل شيئاً آخر.
      isArchived: false,
      archivedAt: null,
      createdById: data.createdById ?? null,
    },
  })
  const version = await snapshotTemplateVersion(created, actor, 'إنشاء القالب')
  return { template: created, version }
}

/** تحديث قالب (يُنشئ نسخة جديدة تلقائياً) — لا يمس الأرشفة هنا. */
export interface TemplateUpdateInput
  extends Partial<Omit<TemplateContentInput, 'variables' | 'richDocument'>> {
  isDefault?: boolean
  platform?: string
  variables?: unknown
  richDocument?: unknown
}

export async function updateTemplateWithVersion(
  templateId: string,
  data: TemplateUpdateInput,
  actor: TemplateVersionActor = {},
  changeNote = 'تعديل القالب',
): Promise<{ template: SocialPostTemplate; version: number }> {
  const updated = await db.socialPostTemplate.update({
    where: { id: templateId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.parseMode !== undefined ? { parseMode: data.parseMode } : {}),
      ...(data.mediaUrl !== undefined ? { mediaUrl: data.mediaUrl } : {}),
      ...(data.variables !== undefined ? { variables: data.variables as never } : {}),
      ...(data.richDocument !== undefined ? { richDocument: data.richDocument as never } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(data.platform !== undefined ? { platform: data.platform } : {}),
    },
  })
  const version = await snapshotTemplateVersion(updated, actor, changeNote)
  return { template: updated, version }
}

/** إصدارات قيمة معطى — الأحدث أولاً. */
export async function listTemplateVersions(templateId: string) {
  return db.socialPostTemplateVersion.findMany({
    where: { templateId },
    orderBy: [{ version: 'desc' }],
    take: 100,
  })
}

/**
 * تراجع إلى إصدار سابق: يكتب محتواه على القالب ويُنشئ **نسخة جديدة**
 * بتغيير `تراجع إلى الإصدار N` — التاريخ لا يمحو أبداً.
 * (isDefault يستبعد عمداً من التراجع — تعارض الافتراضي يعالَج في مساره.)
 */
export async function restoreTemplateVersion(
  templateId: string,
  versionId: string,
  actor: TemplateVersionActor = {},
): Promise<{ template: SocialPostTemplate; version: number; restoredFrom: number }> {
  const snapshot = await db.socialPostTemplateVersion.findFirst({
    where: { id: versionId, templateId },
  })
  if (!snapshot) {
    throw new TemplateVersionsError('NOT_FOUND', 'الإصدار غير موجود لهذا القالب', 404)
  }
  const updated = await db.socialPostTemplate.update({
    where: { id: templateId },
    data: {
      name: snapshot.name,
      title: snapshot.title,
      body: snapshot.body,
      parseMode: snapshot.parseMode,
      richDocument: (snapshot.richDocument ?? undefined) as never,
      mediaUrl: snapshot.mediaUrl,
      variables: (snapshot.variables ?? []) as never,
    },
  })
  const version = await snapshotTemplateVersion(
    updated,
    actor,
    `تراجع إلى الإصدار ${snapshot.version}`,
  )
  return { template: updated, version, restoredFrom: snapshot.version }
}

export class TemplateVersionsError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}
