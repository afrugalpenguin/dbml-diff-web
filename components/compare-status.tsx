import { CheckCircle2 } from 'lucide-react'

export type Diagnostic = { schema?: 'old' | 'new'; line?: number; column?: number }

export function CompareStatus({ complete, error, diagnostic }: { complete: boolean; error: string; diagnostic: Diagnostic }) {
  return (
    <>
      {complete && !error && (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
        >
          <CheckCircle2 className="size-4" /> Comparison complete
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{error}</p>
          {diagnostic.line ? (
            <p className="mt-1 font-mono text-xs">
              {diagnostic.schema === 'old' ? 'Schema A' : 'Schema B'}, line {diagnostic.line}
              {diagnostic.column ? `, column ${diagnostic.column}` : ''}
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}
