// ModFormActions — sticky footer (save/cancel).
// Presentational only; onSave lives in the ModForm orchestrator.

import Link from 'next/link'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  saving: boolean
  isEdit: boolean
  onSave: () => void
}

export function ModFormActions({ saving, isEdit, onSave }: Props) {
  return (
    <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/80 p-4 backdrop-blur">
      <Button asChild variant="outline">
        <Link href="/creator/mods">إلغاء</Link>
      </Button>
      <Button onClick={onSave} disabled={saving} className="min-h-[44px]">
        {saving ? (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="ml-2 h-4 w-4" aria-hidden="true" />
        )}
        {isEdit ? 'حفظ التعديلات' : 'نشر التعريب'}
      </Button>
    </div>
  )
}
