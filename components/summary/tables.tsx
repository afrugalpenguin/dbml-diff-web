import type { ModifiedTable, TableEntry } from '../../lib/diff-types'
import { changeSymbol, formatColumn, tableDetailRows } from '../../lib/summary-changes'
import type { TableChange } from '../../lib/summary-groups'
import type { FlashTarget } from './summary'

function TableDetails({ item, target }: { item: TableEntry | ModifiedTable; target?: string }) {
  if (!('columnsAdded' in item)) return item.columns.map((column) => <p key={column.name}>{formatColumn(column)}</p>)
  return tableDetailRows(item).map((row) => (
    <p
      key={row.target}
      className={`${row.target === target ? 'summary-flash-line ' : ''}${row.kind === 'renamed' ? 'text-amber-500' : ''}`}
    >
      {`${changeSymbol[row.kind]} ${row.text}`}
      {row.kind === 'renamed' && (
        <>
          {' '}
          <span>(heuristic - verify)</span>
        </>
      )}
    </p>
  ))
}

function TableRow({
  table,
  isExpanded,
  onToggle,
  flashTarget,
  display,
}: {
  table: TableChange
  isExpanded: boolean
  onToggle: () => void
  flashTarget: FlashTarget | null
  display: (name: string) => string
}) {
  const { item, kind, id, counts } = table
  const flashing = flashTarget?.id === id
  return (
    <article id={id} tabIndex={-1} className="overflow-hidden rounded-md border border-border outline-none">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 ${
          flashing ? 'summary-flash-row' : ''
        }`}
      >
        <span className="font-mono text-sm font-medium">{display(item.name)}</span>
        <span className="flex shrink-0 gap-1 text-xs">
          <span className="text-emerald-500">{counts.added ? `+${counts.added}` : ''}</span>
          <span className="text-red-500">{counts.removed ? `-${counts.removed}` : ''}</span>
          <span className="text-amber-500">{counts.modified ? `~${counts.modified}` : ''}</span>
        </span>
      </button>
      {isExpanded && (
        <div className="border-t border-border px-3 py-3 text-sm">
          <p className="mb-2 text-xs text-muted-foreground">
            {kind === 'Added' ? 'Added in B' : kind === 'Removed' ? 'Removed in B' : 'Modified in B'}
          </p>
          <div className="flex flex-col gap-1 font-mono">
            <TableDetails item={item} target={flashing ? flashTarget.target : undefined} />
          </div>
        </div>
      )}
    </article>
  )
}

export function SummaryTables({
  tables,
  groups,
  count,
  open,
  onToggle,
  alwaysExpanded,
  expanded,
  onToggleTable,
  onExpandAll,
  onCollapseAll,
  flashTarget,
  display,
}: {
  tables: TableChange[]
  groups: Record<string, TableChange[]>
  count: number
  open: boolean
  onToggle: () => void
  alwaysExpanded: boolean
  expanded: Set<string>
  onToggleTable: (id: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  flashTarget: FlashTarget | null
  display: (name: string) => string
}) {
  return (
    <>
      <div id="summary-tables" className="scroll-mt-24 flex items-center justify-between">
        <button onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true">{open ? '⌄' : '›'}</span>Tables{' '}
          <span className="font-mono text-xs text-muted-foreground">{count}</span>
        </button>
        <div className="flex gap-3 text-xs">
          <button onClick={onExpandAll} className="text-muted-foreground hover:text-foreground">
            Expand all
          </button>
          <button onClick={onCollapseAll} className="text-muted-foreground hover:text-foreground">
            Collapse all
          </button>
        </div>
      </div>
      {open &&
        Object.entries(groups).map(([schema, entries]) => (
          <section key={schema} className="flex flex-col gap-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">{schema}</h3>
            {entries.map((table) => (
              <TableRow
                key={table.id}
                table={table}
                isExpanded={alwaysExpanded || expanded.has(table.id)}
                onToggle={() => onToggleTable(table.id)}
                flashTarget={flashTarget}
                display={display}
              />
            ))}
          </section>
        ))}
      {tables.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No matching changes.</p>}
    </>
  )
}
