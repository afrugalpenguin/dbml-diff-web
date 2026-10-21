'use client'

import { useState } from 'react'
import { ArrowLeftRight, GitCompareArrows, Loader2 } from 'lucide-react'
import { CodeEditor } from '../components/code-editor'
import { CompareStatus, type Diagnostic } from '../components/compare-status'
import { ComparisonResult, type ResultTab } from '../components/comparison-result'
import { SiteFooter } from '../components/site-footer'
import { SiteHeader } from '../components/site-header'
import { editorFocusLine } from '../lib/dbml-locate'
import { MAX_SCHEMA_BYTES } from '../lib/limits'
import type { ComparisonPayload } from '../lib/diff-types'

const initialOld = `TABLE dbo.Shipments {
  Id UNIQUEIDENTIFIER [not null]
  CarrierId UNIQUEIDENTIFIER
  Freight DECIMAL(24,8)
  Indexes { Id [pk] }
}`
const initialNew = `TABLE dbo.Shipments {
  Id UNIQUEIDENTIFIER [not null]
  CarrierId UNIQUEIDENTIFIER
  Freight DECIMAL(24,8)
  Indexes { Id [pk] }
}

TABLE dbo.PlanKind {
  Id INT [not null]
  Title NVARCHAR(100) [not null]
  Sku NVARCHAR(50) [not null]
  Indexes { Id [pk] }
}`

export default function Page() {
  const [oldDbml, setOldDbml] = useState(initialOld)
  const [newDbml, setNewDbml] = useState(initialNew)
  const [comparison, setComparison] = useState<ComparisonPayload | null>(null)
  const [comparisonComplete, setComparisonComplete] = useState(false)
  const [tab, setTab] = useState<ResultTab>('Summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({})
  const [focusTarget, setFocusTarget] = useState<{ schema: 'old' | 'new'; line: number; key: number } | null>(null)

  function resetResult() {
    setComparison(null)
    setComparisonComplete(false)
    setError('')
    setDiagnostic({})
    setFocusTarget(null)
  }

  async function compare() {
    setLoading(true)
    setError('')
    setDiagnostic({})
    setComparisonComplete(false)
    const encoder = new TextEncoder()
    if (encoder.encode(oldDbml).byteLength > MAX_SCHEMA_BYTES || encoder.encode(newDbml).byteLength > MAX_SCHEMA_BYTES) {
      setError('Each schema must be 500 KB or smaller.')
      setLoading(false)
      return
    }
    try {
      const response = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldDbml, newDbml }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDiagnostic(data.diagnostic ?? {})
        throw new Error(data.error)
      }
      setComparison(data)
      setComparisonComplete(true)
      setTab('Summary')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-12 max-w-2xl">
          <h1 className="flex items-baseline gap-x-3 whitespace-nowrap text-4xl font-bold tracking-tight sm:text-5xl">
            <span>Compare DBML schemas</span>
            <span className="text-2xl font-semibold text-muted-foreground sm:text-3xl">without the guesswork.</span>
          </h1>
        </div>
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <CodeEditor
            label="Schema A"
            value={oldDbml}
            onChange={setOldDbml}
            errorLine={error && diagnostic.schema === 'old' ? diagnostic.line : undefined}
            focusLine={focusTarget?.schema === 'old' ? focusTarget : undefined}
          />
          <button
            type="button"
            aria-label="Swap source and target schemas"
            title="Swap source and target schemas"
            onClick={() => {
              setOldDbml(newDbml)
              setNewDbml(oldDbml)
              resetResult()
            }}
            className={
              'inline-flex h-10 shrink-0 self-center items-center justify-center gap-2 border border-border bg-card px-3 text-sm ' +
              'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:mt-7'
            }
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" /> Swap
          </button>
          <CodeEditor
            label="Schema B"
            value={newDbml}
            onChange={setNewDbml}
            errorLine={error && diagnostic.schema !== 'old' ? diagnostic.line : undefined}
            focusLine={focusTarget?.schema === 'new' ? focusTarget : undefined}
          />
        </section>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button
            onClick={compare}
            disabled={loading}
            className={
              'inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground ' +
              'transition hover:opacity-90 disabled:opacity-50'
            }
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <GitCompareArrows className="size-4" />} Compare schemas
          </button>
          <button
            onClick={() => {
              setOldDbml('')
              setNewDbml('')
              resetResult()
            }}
            className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <CompareStatus complete={comparisonComplete} error={error} diagnostic={diagnostic} />
        </div>
        {comparison && (
          <ComparisonResult
            comparison={comparison}
            tab={tab}
            onTab={setTab}
            onAttention={(focus) => {
              const target = editorFocusLine(focus, oldDbml, newDbml)
              setFocusTarget((current) => (target ? { ...target, key: (current?.key ?? 0) + 1 } : null))
            }}
          />
        )}
        <SiteFooter />
      </div>
    </main>
  )
}
