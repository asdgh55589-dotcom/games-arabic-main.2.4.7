'use client'

import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MarkdownEditor } from '@/components/admin/markdown-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TEAM_TABS } from '@/lib/team-constants'
import type { TeamCustomTabData } from './types'

interface TeamTabsTabProps {
  hiddenTabs: string
  customTabs: TeamCustomTabData[]
  onChange: (patch: { hiddenTabs?: string; customTabs?: TeamCustomTabData[] }) => void
}

export function TeamTabsTab({ hiddenTabs, customTabs, onChange }: TeamTabsTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const hiddenSet = new Set(
    hiddenTabs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

  const toggleTab = (key: string) => {
    const newHidden = new Set(hiddenSet)
    if (newHidden.has(key)) {
      newHidden.delete(key)
    } else {
      newHidden.add(key)
    }
    onChange({ hiddenTabs: Array.from(newHidden).join(',') })
  }

  const addCustomTab = () => {
    onChange({
      customTabs: [
        ...customTabs,
        { title: '', content: '', order: customTabs.length, visible: true },
      ],
    })
    setEditingIndex(customTabs.length)
  }

  const updateCustomTab = (index: number, patch: Partial<TeamCustomTabData>) => {
    const updated = customTabs.map((t, i) => (i === index ? { ...t, ...patch } : t))
    onChange({ customTabs: updated })
  }

  const removeCustomTab = (index: number) => {
    const updated = customTabs.filter((_, i) => i !== index)
    onChange({ customTabs: updated })
    if (editingIndex === index) setEditingIndex(null)
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  return (
    <div className="space-y-6">
      {/* Hide/show basic tabs */}
      <div>
        <h3 className="mb-2 text-sm font-bold">إظهار/إخفاء التبويبات الأساسية</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          اختر أي تبويبات تريد إخفاءها من صفحة الفريق العامة
        </p>
        <div className="flex flex-wrap gap-2">
          {TEAM_TABS.map((t) => {
            const isHidden = hiddenSet.has(t.key)
            return (
              <button
                key={t.key}
                onClick={() => toggleTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  isHidden
                    ? 'border-red-500/30 bg-red-500/10 text-red-400 line-through'
                    : 'border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <t.icon className="h-3 w-3" />
                {t.label}
                {isHidden && <span className="text-[10px]">(مخفي)</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom tabs */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">تبويبات مخصصة</h3>
            <p className="text-xs text-muted-foreground">أضف تبويبات مخصصة للفريق</p>
          </div>
          <Button size="sm" className="min-h-[44px]" variant="outline" onClick={addCustomTab}>
            <Plus className="ml-1 h-3 w-3" /> إضافة تبويب
          </Button>
        </div>

        {customTabs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">لا توجد تبويبات مخصصة</p>
        ) : (
          <div className="space-y-3">
            {customTabs.map((tab, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{tab.title || `تبويب ${i + 1}`}</span>
                    {!tab.visible && (
                      <span className="text-[10px] text-muted-foreground">(مخفي)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs min-h-[44px]"
                      onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                    >
                      {editingIndex === i ? 'إخفاء' : 'تعديل'}
                    </Button>
                    <button
                      onClick={() => updateCustomTab(i, { visible: !tab.visible })}
                      className="inline-flex h-7 items-center rounded px-2 text-xs text-muted-foreground hover:bg-accent"
                    >
                      {tab.visible ? 'إخفاء' : 'إظهار'}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                      onClick={() => removeCustomTab(i)}
                      aria-label="إجراء"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {editingIndex === i && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <Label className="text-xs">العنوان</Label>
                      <Input
                        value={tab.title}
                        onChange={(e) => updateCustomTab(i, { title: e.target.value })}
                        placeholder="اسم التبويب"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">المحتوى (Markdown)</Label>
                      <div className="mt-1">
                        <MarkdownEditor
                          value={tab.content}
                          onChange={(content) => updateCustomTab(i, { content })}
                          rows={5}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
