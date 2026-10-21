'use client'

import { Copy } from 'lucide-react'
import type { ComparisonPayload } from '../lib/diff-types'
import type { EditorFocus } from '../lib/summary-changes'
import { Summary } from './summary/summary'

export const resultTabs = ['Summary', 'Text', 'Migration', 'DBML'] as const
export type ResultTab = (typeof resultTabs)[number]

const tabOutput = { Text: 'text', Migration: 'migration', DBML: 'dbml' } as const

export function ComparisonResult({
  comparison,
  tab,
  onTab,
  onAttention,
}: {
  comparison: ComparisonPayload
  tab: ResultTab
  onTab: (tab: ResultTab) => void
  onAttention: (focus: EditorFocus) => void
}) {
  const parsed = comparison.parsedResult
  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="font-semibold">Comparison result</p>
          <p className="font-mono text-xs text-muted-foreground">{comparison.id}</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
        {resultTabs.map((name) => (
          <button
            key={name}
            onClick={() => onTab(name)}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${
              tab === name ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="p-5">
        {tab === 'Summary' ? (
          <Summary parsed={parsed} counts={parsed.counts} onAttention={onAttention} />
        ) : (
          <div className="relative">
            {tab === 'Migration' && <h2 className="mb-3 text-lg font-semibold">SQL to turn A into B</h2>}
            <button
              onClick={() => navigator.clipboard.writeText(comparison[tabOutput[tab]])}
              className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs"
            >
              <Copy className="size-3" /> Copy
            </button>
            <pre className="max-h-[620px] overflow-auto rounded-md bg-muted/50 p-5 pt-12 font-mono text-xs leading-6">
              {comparison[tabOutput[tab]]}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
