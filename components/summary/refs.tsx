import type { RefEndpoint } from '../../lib/diff-types'
import { refSymbolClass, refTargetText, truncateName, type RefRow } from '../../lib/summary-groups'

export function SummaryRefs({
  groups,
  matches,
  display,
  displayEndpoint,
}: {
  groups: Array<[string, RefRow[]]>
  matches: (value: string) => boolean
  display: (name: string) => string
  displayEndpoint: (endpoint: RefEndpoint) => string
}) {
  return (
    <article className="rounded-md border border-border p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refs</p>
      <div className="flex flex-col gap-5">
        {groups
          .filter(([table, rows]) => matches(table) || rows.some(({ ref }) => matches(displayEndpoint(ref.from))))
          .map(([table, rows]) => (
            <section key={table}>
              <h4 className="mb-2 font-mono text-sm font-semibold">{display(table)}</h4>
              <div className="flex flex-col gap-1 text-sm">
                {rows
                  .filter(({ ref }) => matches(displayEndpoint(ref.from)))
                  .sort((a, b) => a.ref.from.columns.join(', ').localeCompare(b.ref.from.columns.join(', ')))
                  .map(({ symbol, ref }) => {
                    const column = ref.from.columns.join(', ')
                    const target = refTargetText(ref, displayEndpoint)
                    return (
                      <div
                        key={`${symbol}-${table}-${column}-${target}`}
                        className="flex flex-wrap items-baseline gap-x-2 font-mono"
                      >
                        <span className={`w-4 shrink-0 ${refSymbolClass(symbol)}`}>{symbol}</span>
                        <span className="min-w-0 whitespace-nowrap" title={column}>
                          {truncateName(column)}
                        </span>
                        <span className="w-5 shrink-0 text-sky-500">{'\u2192'}</span>
                        <span className="min-w-0 whitespace-nowrap" title={target}>
                          {truncateName(target)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </section>
          ))}
      </div>
    </article>
  )
}
