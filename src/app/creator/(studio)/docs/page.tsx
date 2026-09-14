// Creator documentation page — shows mod form field reference.
// Accessible to all creator roles.

'use client'

import { useState } from 'react'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { DocumentationPanel, DocsNav } from '@/components/docs/documentation-panel'
import { ALL_DOCS } from '@/lib/docs/mod-form-docs'

export default function CreatorDocsPage() {
  const [activePage, setActivePage] = useState(ALL_DOCS[0].id)
  const currentPage = ALL_DOCS.find((p) => p.id === activePage) || ALL_DOCS[0]

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6" dir="rtl">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">دليل حقول التعريب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            شرح مفصل لكل حقل في نموذج إضافة التعريب — مع أمثلة ونصائح
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar Nav */}
          <aside className="shrink-0 lg:w-56">
            <div className="sticky top-4 rounded-xl border border-border bg-card/30 p-3">
              <DocsNav
                pages={ALL_DOCS}
                activePage={activePage}
                onSelect={setActivePage}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1">
            <DocumentationPanel page={currentPage} />
          </main>
        </div>
      </div>
    </>
  )
}
