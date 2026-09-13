'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Cloud,
  Download,
  EyeOff,
  Heart,
  History,
  Loader2,
  RefreshCw,
  Wrench,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface WorkerHealthState {
  ok: boolean
  cache: 'available' | 'unavailable' | 'unconfigured'
  configured: boolean
}

interface HealthData {
  currentWeek: number
  currentPlatform: string
  currentDay: number
  monthlyStats: { totalChecked: number; totalBroken: number; healthPercent: number }
  weeklySchedule: Array<{
    week: number
    platform: string
    status: string
    broken: number
    logsCount: number
  }>
  brokenImages: Array<{
    id: string
    modId: string
    imageType: string
    imageUrl: string
    detectedAt: string
    status: string
    mod: { id: string; name: string; slug: string }
  }>
  healthLogs: Array<{
    id: string
    platform: string
    week: number
    day: number
    checked: number
    broken: number
    modsAffected: number
    status: string
    createdAt: string
    startedAt: string
    completedAt: string | null
  }>
  todayProgress: { checked: number; total: number; batchSize: number; currentBatch: number }
  cloudinaryUsage: {
    storage: number
    storagePercent: number
    bandwidth?: number
    transformations?: number
    unavailable?: boolean
    configured?: boolean
  }
}

export default function ImageHealthPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [data, setData] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthState | null>(null)

  const fetchHealthData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/images/health', { cache: 'no-store' })
      if (!res.ok) throw new Error('فشل التحميل')
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات'
      setError(msg)
      toast({ title: 'فشل تحميل البيانات', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchWorkerHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/worker-health', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setWorkerHealth(json.data)
      }
    } catch {
      // Silent — worker health is informational
    }
  }, [])

  useEffect(() => {
    fetchHealthData()
    fetchWorkerHealth()
  }, [fetchHealthData, fetchWorkerHealth])

  const handleManualCheck = async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/admin/images/health', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'فشل الفحص')
      const result = json.data
      if (result?.skipped) {
        toast({ title: 'يوم راحة', description: 'اليوم الخميس أو الجمعة — لا فحص مجدول' })
      } else {
        toast({
          title: 'اكتمل الفحص',
          description: `تم فحص ${result.checked ?? 0} تعريب، ${result.brokenCount ?? 0} صورة مكسورة`,
        })
      }
      await fetchHealthData()
    } catch (err) {
      toast({
        title: 'فشل الفحص اليدوي',
        description: err instanceof Error ? err.message : 'حاول مرة أخرى',
        variant: 'destructive',
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleMarkFixed = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/images/broken/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fixed' }),
      })
      if (!res.ok) throw new Error('فشل التحديث')
      toast({ title: 'تم تمييز الصورة كمُصلحة ✅' })
      fetchHealthData()
    } catch {
      toast({ title: 'فشل تحديث الحالة', variant: 'destructive' })
    }
  }

  const handleMarkIgnored = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/images/broken/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ignored' }),
      })
      if (!res.ok) throw new Error('فشل التحديث')
      toast({ title: 'تم تجاهل الصورة' })
      fetchHealthData()
    } catch {
      toast({ title: 'فشل تحديث الحالة', variant: 'destructive' })
    }
  }

  const handleExport = () => {
    if (!data) return
    const rows = [
      ['التعريب', 'النوع', 'الرابط', 'تاريخ الاكتشاف', 'الحالة'],
      ...data.brokenImages.map((img) => [
        img.mod.name,
        img.imageType,
        img.imageUrl,
        new Date(img.detectedAt).toISOString(),
        img.status,
      ]),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `broken-images-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'تم تصدير التقرير' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جاري تحميل بيانات صحة الصور...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>فشل التحميل</AlertTitle>
          <AlertDescription>{error} — حاول تحديث الصفحة</AlertDescription>
        </Alert>
        <Button onClick={fetchHealthData} className="mt-4">
          إعادة المحاولة
        </Button>
      </div>
    )
  }

  const stats = data?.monthlyStats ?? { totalChecked: 0, totalBroken: 0, healthPercent: 100 }
  const healthyCount = Math.max(0, stats.totalChecked - stats.totalBroken)
  const healthLabel =
    stats.healthPercent >= 95
      ? 'ممتاز'
      : stats.healthPercent >= 90
        ? 'جيد'
        : stats.healthPercent >= 80
          ? 'مقبول'
          : 'يحتاج اهتمام'
  const healthColor =
    stats.healthPercent >= 95
      ? 'text-emerald-600'
      : stats.healthPercent >= 90
        ? 'text-green-600'
        : stats.healthPercent >= 80
          ? 'text-amber-600'
          : 'text-red-600'

  const currentWeek = data?.currentWeek ?? 1
  const currentPlatform = data?.currentPlatform ?? 'PC'
  const currentDay = data?.currentDay ?? -1
  const weeklySchedule = data?.weeklySchedule ?? []
  const brokenImages = data?.brokenImages ?? []
  const healthLogs = data?.healthLogs ?? []
  const todayProgress = data?.todayProgress ?? {
    checked: 0,
    total: 0,
    batchSize: 0,
    currentBatch: 0,
  }
  const cloudinaryUsage = data?.cloudinaryUsage ?? { storage: 0, storagePercent: 0 }

  const storageGB = (cloudinaryUsage.storage / (1024 * 1024 * 1024)).toFixed(2)

  // SA-3: شارة حالة Cloudinary من الـ probe الحقيقي (lib/image-health-check).
  // unavailable (فشل الـ probe) → غير متاح | غير مُكوَّن → غير مُكوَّن | غير ذلك → متصل.
  // مسار الأصفار القديم (configured غير موجود) يُفسَّر كغير مُكوَّن للتوافق.
  const cloudinaryStatus: 'connected' | 'unconfigured' | 'unavailable' =
    cloudinaryUsage.unavailable
      ? 'unavailable'
      : cloudinaryUsage.configured === false ||
          (cloudinaryUsage.configured === undefined &&
            cloudinaryUsage.storage === 0 &&
            cloudinaryUsage.storagePercent === 0)
        ? 'unconfigured'
        : 'connected'
  const progressPercent =
    todayProgress.total > 0 ? (todayProgress.checked / todayProgress.total) * 100 : 0

  return (
    <div className="container mx-auto py-6 space-y-8" dir="rtl">
      {/* ===== Section 1: Hero Header ===== */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-3xl">🖼️</span> صحة الصور في الموقع
          </h1>
          <p className="text-muted-foreground mt-2">
            نظام ذكي لمراقبة صحة الصور وتوزيع الحمل شهرياً — كل أسبوع منصة، كل يوم دفعة
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleManualCheck} disabled={isChecking} className="gap-2">
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            فحص يدوي الآن
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير تقرير
          </Button>
        </div>
      </div>

      {/* ===== Section 2: Stats Cards ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white text-sm font-medium">
              <ClipboardList className="h-4 w-4" />
              إجمالي المفحوصة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalChecked.toLocaleString('ar-EG')}</div>
            <p className="text-blue-100 text-sm mt-2">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              السليمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{healthyCount.toLocaleString('ar-EG')}</div>
            <p className="text-green-100 text-sm mt-2">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white text-sm font-medium">
              <XCircle className="h-4 w-4" />
              المكسورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalBroken.toLocaleString('ar-EG')}</div>
            <p className="text-red-100 text-sm mt-2">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white text-sm font-medium">
              <Heart className="h-4 w-4" />
              نسبة الصحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.healthPercent}%</div>
            <p className="text-emerald-100 text-sm mt-2">{healthLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Section 3: Current Status ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            الفحص الحالي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">الأسبوع</p>
              <p className="text-2xl font-bold mt-1">{currentWeek} من 4</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">المنصة</p>
              <p className="text-2xl font-bold mt-1">{currentPlatform}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">اليوم</p>
              <p className="text-2xl font-bold mt-1">
                {currentDay === -1 ? 'راحة' : `${currentDay + 1} من 5`}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">الحالة</p>
              <div className="mt-2 flex justify-center">
                <Badge
                  variant={currentDay === -1 ? 'secondary' : 'default'}
                  className="text-sm px-3 py-1"
                >
                  {currentDay === -1 ? 'يوم راحة (الخميس/الجمعة)' : 'جاري الفحص'}
                </Badge>
              </div>
            </div>
          </div>

          {currentDay !== -1 && todayProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">تقدم اليوم</span>
                <span className="font-medium">
                  {todayProgress.checked} / {todayProgress.total} تعريب
                  {todayProgress.batchSize > 0 && ` (الدفعة: ${todayProgress.currentBatch})`}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progressPercent.toFixed(0)}% مكتمل — كل يوم يتم فحص ~{todayProgress.batchSize}{' '}
                تعديل
              </p>
            </div>
          )}
          {currentDay === -1 && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertTitle>يوم راحة</AlertTitle>
              <AlertDescription>
                اليوم الخميس أو الجمعة — لا يوجد فحص مجدول. سيتم استئناف الفحص يوم السبت للمنصة
                التالية.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 4: Weekly Schedule Timeline ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            جدول الفحص الأسبوعي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {weeklySchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد بيانات بعد — سيبدأ الجدول مع أول فحص
            </p>
          ) : (
            weeklySchedule.map((week) => (
              <div
                key={week.week}
                className={`p-4 rounded-lg border-2 transition-all ${
                  week.status === 'complete'
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                    : week.status === 'in_progress'
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 animate-pulse'
                      : 'bg-gray-50 border-gray-200 dark:bg-muted/30 dark:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {week.status === 'complete'
                        ? '✅'
                        : week.status === 'in_progress'
                          ? '🔄'
                          : '⏸️'}
                    </div>
                    <div>
                      <h3 className="font-bold">
                        الأسبوع {week.week}: {week.platform}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {week.status === 'complete'
                          ? `مكتمل — ${week.logsCount}/5 أيام`
                          : week.status === 'in_progress'
                            ? 'جاري — هذا الأسبوع'
                            : 'في الانتظار'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {week.broken > 0 && <Badge variant="destructive">{week.broken} مكسور</Badge>}
                    {week.logsCount > 0 && <Badge variant="outline">{week.logsCount} فحص</Badge>}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ===== Section 5: Broken Images Table ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            الصور المكسورة ({brokenImages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brokenImages.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">ممتاز! لا توجد صور مكسورة</h3>
              <p className="text-muted-foreground">
                جميع الصور تعمل بشكل صحيح — نسبة الصحة {stats.healthPercent}%
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التعريب</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>تاريخ الاكتشاف</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brokenImages.map((img) => (
                      <TableRow key={img.id}>
                        <TableCell>
                          <Link
                            href={`/admin/mods/${img.mod.id}/edit`}
                            className="font-medium hover:underline text-primary"
                          >
                            {img.mod.name}
                          </Link>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {img.imageUrl.slice(0, 50)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {img.imageType === 'cover'
                              ? 'غلاف'
                              : img.imageType === 'banner'
                                ? 'بانر'
                                : img.imageType.startsWith('screenshot')
                                  ? 'لقطة شاشة'
                                  : img.imageType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(img.detectedAt), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkFixed(img.id)}
                              className="gap-1 min-h-[44px]"
                            >
                              <Wrench className="h-3 w-3" /> إصلاح
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkIgnored(img.id)}
                              className="gap-1 min-h-[44px]"
                            >
                              <EyeOff className="h-3 w-3" /> تجاهل
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {brokenImages.map((img) => (
                  <Card key={img.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/admin/mods/${img.mod.id}/edit`}
                          className="font-bold hover:underline text-primary line-clamp-2 flex-1"
                        >
                          {img.mod.name}
                        </Link>
                        <Badge
                          variant={
                            img.status === 'fixed'
                              ? 'default'
                              : img.status === 'ignored'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="shrink-0 text-xs"
                        >
                          {img.status === 'fixed'
                            ? 'تم الإصلاح'
                            : img.status === 'ignored'
                              ? 'متجاهل'
                              : 'مكسور'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {img.imageType === 'cover'
                            ? 'غلاف'
                            : img.imageType === 'banner'
                              ? 'بانر'
                              : img.imageType.startsWith('screenshot')
                                ? 'لقطة شاشة'
                                : img.imageType}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(img.detectedAt), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                      <div className="rounded-md bg-muted p-2">
                        <p className="text-xs text-muted-foreground mb-1">الرابط:</p>
                        <p className="text-xs break-all font-mono leading-relaxed">
                          {img.imageUrl}
                        </p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkFixed(img.id)}
                          className="flex-1 gap-1 min-h-[44px]"
                        >
                          <Wrench className="h-4 w-4" /> إصلاح
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkIgnored(img.id)}
                          className="flex-1 gap-1 min-h-[44px] border"
                        >
                          <EyeOff className="h-4 w-4" /> تجاهل
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 6: Cloudinary Usage ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-sky-500" />
            استخدام Cloudinary
            {cloudinaryStatus === 'connected' && <Badge variant="default">متصل</Badge>}
            {cloudinaryStatus === 'unconfigured' && <Badge variant="secondary">غير مُكوَّن</Badge>}
            {cloudinaryStatus === 'unavailable' && <Badge variant="destructive">غير متاح</Badge>}
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="text-sm font-normal text-muted-foreground">عامل الصور:</span>
            {workerHealth === null && <Badge variant="outline">جاري التحقق...</Badge>}
            {workerHealth?.ok === true && <Badge className="bg-green-600 hover:bg-green-700">متصل</Badge>}
            {workerHealth?.configured === false && <Badge variant="secondary">غير مُكوَّن</Badge>}
            {workerHealth?.ok === false && workerHealth?.configured === true && (
              <Badge variant="destructive">معطل</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>التخزين</span>
              <span className="font-medium">
                {storageGB} GB / 25 GB ({cloudinaryUsage.storagePercent}%)
              </span>
            </div>
            <Progress value={Math.min(100, cloudinaryUsage.storagePercent)} className="h-3" />
            {cloudinaryUsage.storagePercent > 80 && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>تحذير: التخزين يقترب من الحد الأقصى</AlertTitle>
                <AlertDescription>
                  استخدمت {cloudinaryUsage.storagePercent}% من المساحة المتاحة (25GB). فكّر في تنظيف
                  الصور القديمة.
                </AlertDescription>
              </Alert>
            )}
            {cloudinaryStatus !== 'unavailable' && cloudinaryUsage.storagePercent <= 80 && (
              <p className="text-xs text-muted-foreground mt-2">
                {cloudinaryUsage.storagePercent < 50
                  ? '✅ الاستخدام ضمن الحدود الآمنة'
                  : '⚠️ الاستخدام متوسط — راقب الاستهلاك'}
              </p>
            )}
            {cloudinaryStatus === 'unavailable' && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ تعذّر الوصول إلى Cloudinary — تحقق من الإعدادات (CLOUDINARY_ENABLED والمفاتيح)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-sm text-muted-foreground">النطاق (Bandwidth)</p>
              <p className="text-lg font-bold mt-1">
                {cloudinaryUsage.bandwidth
                  ? (cloudinaryUsage.bandwidth / 1024 / 1024 / 1024).toFixed(2) + ' GB'
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-sm text-muted-foreground">التحويلات</p>
              <p className="text-lg font-bold mt-1">
                {cloudinaryUsage.transformations
                  ? cloudinaryUsage.transformations.toLocaleString('ar-EG')
                  : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            يتم التحديث تلقائياً عند كل فحص — الحد المجاني 25GB تخزين
          </p>
        </CardContent>
      </Card>

      {/* ===== Section 7: Recent Health Logs ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            سجل الفحوصات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              لا يوجد سجل بعد — سيظهر هنا بعد أول فحص
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المنصة</TableHead>
                    <TableHead>الأسبوع</TableHead>
                    <TableHead>اليوم</TableHead>
                    <TableHead>المفحوص</TableHead>
                    <TableHead>المكسور</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthLogs.slice(0, 10).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.startedAt || log.createdAt), 'PPp', { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.platform}</Badge>
                      </TableCell>
                      <TableCell>{log.week}</TableCell>
                      <TableCell>{log.day === -1 ? 'راحة' : log.day + 1}</TableCell>
                      <TableCell>{log.checked}</TableCell>
                      <TableCell>
                        {log.broken > 0 ? (
                          <Badge variant="destructive">{log.broken}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === 'completed'
                              ? 'default'
                              : log.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {log.status === 'completed'
                            ? '✅ مكتمل'
                            : log.status === 'failed'
                              ? '❌ فشل'
                              : log.status === 'in_progress'
                                ? '🔄 جاري'
                                : '⏸️ متوقف'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
