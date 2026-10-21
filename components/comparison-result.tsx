'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Copy } from 'lucide-react'
import type { ComparisonPayload } from '../lib/diff-types'
import type { EditorFocus } from '../lib/summary-changes'
import { Summary } from './summary/summary'

// React Flow and dagre load only when the Diagram tab is first opened.
const DiffDiagram = dynamic(() => import('./diff-diagram').then((module) => module.DiffDiagram), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-muted-foreground">Loading diagram...</p>,
})

export const resultTabs = ['Summary', 'Diagram', 'Text', 'Migration', 'DBML'] as const
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
  const graph = comparison.graph
  const [jump, setJump] = useState<{ table: string; key: number }>()
  // Once opened, the diagram stays mounted so dragged positions survive a jump to the Summary and back.
  const [diagramOpened, setDiagramOpened] = useState(false)
  if (tab === 'Diagram' && !diagramOpened) setDiagramOpened(true)
  const tabs = resultTabs.filter((name) => name !== 'Diagram' || graph)

  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="font-semibold">Comparison result</p>
          <p className="font-mono text-xs text-muted-foreground">{comparison.id}</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
        {tabs.map((name) => (
          <button
            key={name}
            onClick={() => {
              setJump(undefined)
              onTab(name)
            }}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${
              tab === name ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="p-5">
        {graph && diagramOpened && (
          <div hidden={tab !== 'Diagram'}>
            <DiffDiagram
              graph={graph}
              onSelectTable={(table) => {
                setJump((current) => ({ table, key: (current?.key ?? 0) + 1 }))
                onTab('Summary')
              }}
            />
          </div>
        )}
        {tab === 'Summary' && <Summary parsed={parsed} counts={parsed.counts} onAttention={onAttention} jumpTo={jump} />}
        {tab !== 'Summary' && tab !== 'Diagram' && (
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
