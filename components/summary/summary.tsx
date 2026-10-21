'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DiffResult, RefEndpoint } from '../../lib/diff-types'
import { attentionItems, type EditorFocus } from '../../lib/summary-changes'
import {
  displayName,
  enumChanges,
  groupBySchema,
  groupMoves,
  groupSections,
  matchesQuery,
  refRows,
  refRowsByTable,
  sharedSchemaPrefix,
  tableChanges,
} from '../../lib/summary-groups'
import { SummaryAttention } from './attention'
import { SummaryEnums } from './enums'
import { SummaryGroups } from './groups'
import { SummaryLegend } from './legend'
import { SummaryRefs } from './refs'
import { SummaryTables } from './tables'
import { SummaryToolbar, type ChangeFilter, type KindFilter, type SectionCounts } from './toolbar'

export type FlashTarget = { id: string; target?: string }

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function Summary({
  parsed,
  counts,
  onAttention = () => {},
}: {
  parsed: DiffResult
  counts: DiffResult['counts']
  onAttention?: (focus: EditorFocus) => void
}) {
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('All')
  const [kindFilter, setKindFilter] = useState<KindFilter>('All')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [flashTarget, setFlashTarget] = useState<FlashTarget | null>(null)
  const allTableChanges = useMemo(() => tableChanges(parsed.tables), [parsed.tables])
  const matches = (value: string) => matchesQuery(query, value)
  const visibleTables = allTableChanges
    .filter(
      ({ item, kind }) =>
        (changeFilter === 'All' || changeFilter === kind) &&
        (kindFilter === 'All' || kindFilter === 'Tables') &&
        matches(item.name),
    )
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.item.name.localeCompare(b.item.name))
  const attention = attentionItems(parsed).filter(({ text }) => matches(text))
  const sharedSchema = sharedSchemaPrefix(parsed)
  const display = (name: string) => displayName(name, sharedSchema)
  const displayEndpoint = (endpoint: RefEndpoint) => `${display(endpoint.table)}.${endpoint.columns.join(', ')}`
  const enums = enumChanges(parsed.enums)
  const refs = refRows(parsed.refs)
  const moves = groupMoves(parsed.groups)
  const sections = groupSections(parsed.groups, moves)
  const totalChanges = counts.added + counts.removed + counts.modified
  const sectionCounts: SectionCounts = {
    attention: attention.length,
    tables: visibleTables.length,
    groups: moves.length + sections.reduce((sum, group) => sum + group.additions.length + group.removals.length, 0),
    enums: enums.length,
    refs: refs.length,
  }
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    attention: true,
    tables: true,
    groups: totalChanges <= 20,
    enums: totalChanges <= 20,
    refs: totalChanges <= 20,
  })
  const [showTopButton, setShowTopButton] = useState(false)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        setShowTopButton(window.scrollY > 500)
        frame = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])
  const toggleSection = (section: string) =>
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  const toggleTable = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const jumpTo = (target: FlashTarget) => {
    setExpanded((current) => new Set(current).add(target.id))
    setFlashTarget(target)
    window.setTimeout(() => setFlashTarget((current) => (current?.id === target.id ? null : current)), 1500)
    requestAnimationFrame(() => {
      const row = document.getElementById(target.id)
      row?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
      row?.focus({ preventScroll: true })
    })
  }
  return (
    <div className="flex flex-col gap-5">
      <SummaryToolbar
        parsed={parsed}
        counts={counts}
        sectionCounts={sectionCounts}
        onSection={(section) =>
          document.getElementById(`summary-${section}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
        }
        changeFilter={changeFilter}
        onChangeFilter={setChangeFilter}
        kindFilter={kindFilter}
        onKindFilter={setKindFilter}
        query={query}
        onQuery={setQuery}
      />
      <SummaryAttention
        items={attention}
        open={openSections.attention}
        onToggle={() => toggleSection('attention')}
        onSelect={(item) => {
          jumpTo({ id: item.id, target: item.target })
          onAttention(item.focus)
        }}
      />
      <SummaryTables
        tables={visibleTables}
        groups={groupBySchema(visibleTables)}
        count={sectionCounts.tables}
        open={openSections.tables}
        onToggle={() => toggleSection('tables')}
        alwaysExpanded={totalChanges < 10}
        expanded={expanded}
        onToggleTable={toggleTable}
        onExpandAll={() => setExpanded(new Set(allTableChanges.map(({ id }) => id)))}
        onCollapseAll={() => setExpanded(new Set())}
        flashTarget={flashTarget}
        display={display}
      />
      {sharedSchema && (
        <p className="font-mono text-xs text-muted-foreground">All tables in {sharedSchema.slice(0, -1)}</p>
      )}
      {kindFilter !== 'Tables' && (
        <div className="flex w-full flex-col gap-5">
          {(kindFilter === 'All' || kindFilter === 'Groups') && (
            <SummaryGroups
              moves={moves}
              sections={sections}
              count={sectionCounts.groups}
              open={openSections.groups}
              onToggle={() => toggleSection('groups')}
              matches={matches}
              display={display}
            />
          )}
          {(kindFilter === 'All' || kindFilter === 'Enums') && (
            <SummaryEnums
              changes={enums.filter(
                ([kind, item]) => (changeFilter === 'All' || kind === changeFilter.toLowerCase()) && matches(item.name),
              )}
            />
          )}
          {(kindFilter === 'All' || kindFilter === 'Refs') && (
            <SummaryRefs
              groups={refRowsByTable(refs)}
              matches={matches}
              display={display}
              displayEndpoint={displayEndpoint}
            />
          )}
        </div>
      )}
      {showTopButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          className="fixed bottom-5 right-5 z-20 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
        >
          Back to top
        </button>
      )}
      <SummaryLegend />
    </div>
  )
}
