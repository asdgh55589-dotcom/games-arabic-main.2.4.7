// DocumentationPanel — renders a DocPage with collapsible sections.
// Used by both creator and admin documentation pages.

'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { BookOpen, Lightbulb, AlertTriangle } from 'lucide-react'
import type { DocPage, DocSection, DocBlock } from '@/lib/docs/mod-form-docs'

// ═══ Block Renderers ═══

function TextBlock({ block }: { block: DocBlock }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
}

function ListBlock({ block }: { block: DocBlock }) {
  return (
    <ul className="list-disc space-y-1 pr-5 text-sm text-muted-foreground">
      {block.items?.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function ExampleBlock({ block }: { block: DocBlock }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
        <BookOpen className="h-3.5 w-3.5" />
        مثال
      </div>
      <pre className="whitespace-pre-wrap text-sm text-foreground/80">{block.text}</pre>
    </div>
  )
}

function TipBlock({ block }: { block: DocBlock }) {
  return (
    <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
      <p className="text-sm text-blue-700 dark:text-blue-300">{block.text}</p>
    </div>
  )
}

function WarnBlock({ block }: { block: DocBlock }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-sm text-amber-700 dark:text-amber-300">{block.text}</p>
    </div>
  )
}

function FieldBlock({ block }: { block: DocBlock }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="mb-1 text-sm font-bold text-foreground">{block.label}</div>
      <p className="text-sm text-muted-foreground">{block.text}</p>
    </div>
  )
}

function SubBlock({ block }: { block: DocBlock }) {
  return (
    <div>
      {block.label && (
        <div className="mb-1 text-sm font-semibold text-foreground">{block.label}</div>
      )}
      {block.text && <p className="text-sm text-muted-foreground">{block.text}</p>}
      {block.options && (
        <div className="mt-2 space-y-2">
          {block.options.map((opt, i) => (
            <div key={i} className="rounded-md border border-border bg-card/30 p-2">
              <div className="text-xs font-bold text-foreground">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.desc}</div>
            </div>
          ))}
        </div>
      )}
      {block.items && (
        <ul className="mt-1 list-disc space-y-0.5 pr-5 text-sm text-muted-foreground">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  )
}

function BlockRenderer({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'text':    return <TextBlock block={block} />
    case 'list':    return <ListBlock block={block} />
    case 'example': return <ExampleBlock block={block} />
    case 'tip':     return <TipBlock block={block} />
    case 'warn':    return <WarnBlock block={block} />
    case 'field':   return <FieldBlock block={block} />
    case 'sub':     return <SubBlock block={block} />
    default:        return null
  }
}

// ═══ Section Renderer ═══

function SectionCard({ section }: { section: DocSection }) {
  return (
    <AccordionItem value={section.id} className="border-border">
      <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
        <span className="flex items-center gap-2">
          {section.icon && <span>{section.icon}</span>}
          {section.title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        {section.children.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </AccordionContent>
    </AccordionItem>
  )
}

// ═══ Page Renderer ═══

export function DocumentationPanel({ page }: { page: DocPage }) {
  const [openSections, setOpenSections] = useState<string[]>([])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card/30 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {page.icon && <span className="text-xl">{page.icon}</span>}
          {page.title}
        </h2>
        {page.intro && (
          <p className="mt-2 text-sm text-muted-foreground">{page.intro}</p>
        )}
      </div>

      {/* Sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-2"
      >
        {page.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </Accordion>
    </div>
  )
}

// ═══ Navigation Sidebar ═══

export function DocsNav({
  pages,
  activePage,
  onSelect,
}: {
  pages: DocPage[]
  activePage: string
  onSelect: (id: string) => void
}) {
  return (
    <nav className="space-y-1">
      <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        الأقسام
      </div>
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => onSelect(page.id)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            activePage === page.id
              ? 'bg-primary/10 font-bold text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          {page.icon && <span>{page.icon}</span>}
          {page.title}
        </button>
      ))}
    </nav>
  )
}
