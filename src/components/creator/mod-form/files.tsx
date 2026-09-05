// ModFormFiles — section 3 (file meta) + section 5 (download files list).
// Presentational only; all state lives in the ModForm orchestrator.

import { FileArchive, Plus, Trash2 } from 'lucide-react'
import { getPlatformInfo } from '@/components/platform-upload-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Section, Toggle, type DownloadFile } from './primitives'

interface Props {
  version: string
  setVersion: (v: string) => void
  fileSize: string
  setFileSize: (v: string) => void
  fileFormat: string
  setFileFormat: (v: string) => void
  compatibility: string
  setCompatibility: (v: string) => void
  releaseDate: string
  isEdit: boolean
  isFeatured: boolean
  setIsFeatured: (v: boolean) => void
  isTrending: boolean
  setIsTrending: (v: boolean) => void
  isLatest: boolean
  setIsLatest: (v: boolean) => void
  files: DownloadFile[]
  setFiles: (v: DownloadFile[] | ((p: DownloadFile[]) => DownloadFile[])) => void
  addEmptyFile: () => void
}

export function ModFormFiles(p: Props) {
  return (
    <>
      {/* ===== 3. معلومات الملف الأساسية ===== */}
      <Section title="معلومات الملف الأساسية">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="الإصدار">
            <Input
              value={p.version}
              onChange={(e) => p.setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </Field>
          <Field label="حجم الملف" hint="بالصيغة: MB 200">
            <Input
              value={p.fileSize}
              onChange={(e) => p.setFileSize(e.target.value)}
              placeholder="MB 200"
            />
          </Field>
          <Field label="صيغة الملف">
            <select
              value={p.fileFormat}
              onChange={(e) => p.setFileFormat(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="zip">zip</option>
              <option value="7z">7z</option>
              <option value="rar">rar</option>
              <option value="exe">exe</option>
            </select>
          </Field>
        </div>
        <Field label="التوافق">
          <Input
            value={p.compatibility}
            onChange={(e) => p.setCompatibility(e.target.value)}
            placeholder="مثال: متوافق مع كل إصدارات اللعبة"
          />
        </Field>
        {p.isEdit && (
          <Field label="تاريخ النشر" hint="تاريخ ثابت — يُحدّد تلقائياً عند النشر">
            <Input type="date" value={p.releaseDate} disabled className="opacity-60" />
          </Field>
        )}
        <div className="flex flex-wrap gap-4">
          <Toggle label="مميّز" checked={p.isFeatured} onChange={p.setIsFeatured} />
          <Toggle label="رائج" checked={p.isTrending} onChange={p.setIsTrending} />
          <Toggle label="أحدث" checked={p.isLatest} onChange={p.setIsLatest} />
        </div>
      </Section>

      {/* ===== 5. ملفات التحميل ===== */}
      <Section
        title="ملفات التحميل"
        icon={<FileArchive className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            className="min-h-[44px]"
            variant="outline"
            onClick={p.addEmptyFile}
          >
            <Plus className="ml-1 h-4 w-4" /> إضافة ملف
          </Button>
        }
      >
        {p.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            لا توجد ملفات. اضغط "إضافة ملف" لإضافة ملف تحميل.
          </p>
        ) : (
          <div className="space-y-4">
            {p.files.map((file, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">ملف #{i + 1}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() => p.setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`حذف ملف #${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="عنوان الملف">
                    <Input
                      value={file.title}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, title: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label="الإصدار">
                    <Input
                      value={file.version}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, version: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label="الحجم">
                    <Input
                      value={file.fileSize}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) => (idx === i ? { ...f, fileSize: e.target.value } : f)),
                        )
                      }
                    />
                  </Field>
                  <Field label="الصيغة">
                    <select
                      value={file.fileFormat}
                      onChange={(e) =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) =>
                            idx === i ? { ...f, fileFormat: e.target.value } : f,
                          ),
                        )
                      }
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="zip">zip</option>
                      <option value="7z">7z</option>
                      <option value="rar">rar</option>
                      <option value="exe">exe</option>
                    </select>
                  </Field>
                </div>
                <Field label="وصف الملف">
                  <Input
                    value={file.description}
                    onChange={(e) =>
                      p.setFiles((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, description: e.target.value } : f,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="تنبيه (اختياري)">
                  <Input
                    value={file.alert}
                    onChange={(e) =>
                      p.setFiles((prev) =>
                        prev.map((f, idx) => (idx === i ? { ...f, alert: e.target.value } : f)),
                      )
                    }
                    placeholder="مثال: يجب تثبيت الملف الرئيسي أولاً"
                  />
                </Field>

                {/* روابط الملف */}
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      روابط التحميل
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 min-h-[44px]"
                      onClick={() =>
                        p.setFiles((prev) =>
                          prev.map((f, idx) =>
                            idx === i ? { ...f, links: [...f.links, { url: '', label: '' }] } : f,
                          ),
                        )
                      }
                    >
                      <Plus className="ml-1 h-3 w-3" /> إضافة رابط
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {file.links.map((link, j) => {
                      const info = link.url ? getPlatformInfo(link.url) : null
                      return (
                        <div key={j} className="flex items-center gap-2">
                          <div
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-md p-1.5 text-white"
                            style={{ backgroundColor: info?.color || '#4b5563' }}
                          >
                            {info?.icon || <Plus className="h-4 w-4" />}
                          </div>
                          <Input
                            value={link.url}
                            onChange={(e) =>
                              p.setFiles((prev) =>
                                prev.map((f, idx) =>
                                  idx === i
                                    ? {
                                        ...f,
                                        links: f.links.map((l, lidx) =>
                                          lidx === j ? { ...l, url: e.target.value } : l,
                                        ),
                                      }
                                    : f,
                                ),
                              )
                            }
                            placeholder="https://..."
                            className="flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-red-400 shrink-0 min-h-[44px] min-w-[44px]"
                            onClick={() =>
                              p.setFiles((prev) =>
                                prev.map((f, idx) =>
                                  idx === i
                                    ? { ...f, links: f.links.filter((_, lidx) => lidx !== j) }
                                    : f,
                                ),
                              )
                            }
                            aria-label={`حذف رابط #${j + 1} من ملف #${i + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
