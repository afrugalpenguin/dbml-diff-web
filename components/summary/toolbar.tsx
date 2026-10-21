import type { DiffResult } from '../../lib/diff-types'
import type { ChangeFilter, KindFilter } from '../../lib/summary-jump'
export type SummarySection = 'attention' | 'tables' | 'groups' | 'enums' | 'refs'
export type SectionCounts = Record<SummarySection, number>

const sectionOrder: SummarySection[] = ['attention', 'tables', 'groups', 'enums', 'refs']

function Filters<T extends string>({ values, value, onChange }: { values: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-md border px-2.5 py-1 text-xs ${
            value === option
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function SummaryToolbar({
  parsed,
  counts,
  sectionCounts,
  onSection,
  changeFilter,
  onChangeFilter,
  kindFilter,
  onKindFilter,
  query,
  onQuery,
}: {
  parsed: DiffResult
  counts: DiffResult['counts']
  sectionCounts: SectionCounts
  onSection: (section: SummarySection) => void
  changeFilter: ChangeFilter
  onChangeFilter: (value: ChangeFilter) => void
  kindFilter: KindFilter
  onKindFilter: (value: KindFilter) => void
  query: string
  onQuery: (value: string) => void
}) {
  const sections = sectionOrder.filter((section) => sectionCounts[section] > 0)
  return (
    <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
      <p className="font-mono text-sm">
        added: {counts.added}, removed: {counts.removed}, modified: {counts.modified} | groups added:{' '}
        {parsed.groups.added.length}, removed: {parsed.groups.removed.length}, modified:{' '}
        {parsed.groups.modified.length}
      </p>
      <nav aria-label="Summary sections" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {sections.map((section, index) => (
          <span key={section} className="inline-flex items-center gap-3">
            <button onClick={() => onSection(section)} className="text-muted-foreground hover:text-foreground">
              {section === 'attention' ? 'Needs attention' : section[0].toUpperCase() + section.slice(1)}{' '}
              {sectionCounts[section]}
            </button>
            {index < sections.length - 1 && (
              <span aria-hidden="true" className="text-border">
                {'·'}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Filters values={['All', 'Added', 'Removed', 'Modified']} value={changeFilter} onChange={onChangeFilter} />
        <input
          aria-label="Search changes"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search tables, columns, groups..."
          className="h-8 min-w-0 rounded-md border border-border bg-background px-3 text-sm sm:w-64"
        />
      </div>
      <Filters values={['All', 'Tables', 'Groups', 'Enums', 'Refs']} value={kindFilter} onChange={onKindFilter} />
    </div>
  )
}
