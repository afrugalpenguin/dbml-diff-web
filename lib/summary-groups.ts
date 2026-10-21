import type {
  AddedOrRemovedRef,
  DiffResult,
  EnumEntry,
  ModifiedEnum,
  ModifiedTable,
  RefEndpoint,
  RetargetedRef,
  TableEntry,
  UnresolvedRef,
} from './diff-types'
import type { ChangeKind } from './summary-changes'

export type TableChange = {
  item: TableEntry | ModifiedTable
  kind: 'Added' | 'Removed' | 'Modified'
  id: string
  counts: { added: number; removed: number; modified: number }
}

export function tableChanges(tables: DiffResult['tables']): TableChange[] {
  return [
    ...tables.removed.map((item) => ({
      item,
      kind: 'Removed' as const,
      id: `table-${item.name}`,
      counts: { added: 0, removed: item.columns.length, modified: 0 },
    })),
    ...tables.modified.map((item) => ({
      item,
      kind: 'Modified' as const,
      id: `table-${item.name}`,
      counts: {
        added: item.columnsAdded.length,
        removed: item.columnsRemoved.length,
        modified: item.columnsChanged.length + item.renames.length,
      },
    })),
    ...tables.added.map((item) => ({
      item,
      kind: 'Added' as const,
      id: `table-${item.name}`,
      counts: { added: item.columns.length, removed: 0, modified: 0 },
    })),
  ]
}

export function matchesQuery(query: string, value: string): boolean {
  return !query || value.toLowerCase().includes(query.toLowerCase())
}

export function groupBySchema(tables: TableChange[]): Record<string, TableChange[]> {
  return tables.reduce<Record<string, TableChange[]>>((groups, entry) => {
    const schema = entry.item.name.includes('.') ? entry.item.name.split('.')[0] : '(default)'
    ;(groups[schema] ??= []).push(entry)
    return groups
  }, {})
}

export function formatEnum(enumChange: EnumEntry): string {
  return `${enumChange.name} (${enumChange.values.join(', ')})`
}

export function enumChanges(enums: DiffResult['enums']): Array<[ChangeKind, EnumEntry | ModifiedEnum]> {
  return [
    ...enums.added.map((item): [ChangeKind, EnumEntry] => ['added', item]),
    ...enums.removed.map((item): [ChangeKind, EnumEntry] => ['removed', item]),
    ...enums.modified.map((item): [ChangeKind, ModifiedEnum] => ['modified', item]),
  ]
}

// The one schema prefix shared by every changed table and group, so names can be shown without it.
export function sharedSchemaPrefix(parsed: DiffResult): string {
  const allNames = [
    ...parsed.tables.added,
    ...parsed.tables.removed,
    ...parsed.tables.modified,
    ...parsed.groups.added,
    ...parsed.groups.removed,
    ...parsed.groups.modified,
  ].flatMap((item) => ('name' in item ? [item.name] : []))
  const schemaPrefixes = [
    ...new Set(allNames.map((name) => (name.includes('.') ? name.split('.')[0] : '')).filter(Boolean)),
  ]
  return schemaPrefixes.length === 1 ? `${schemaPrefixes[0]}.` : ''
}

export function displayName(name: string, sharedSchema: string): string {
  return name.startsWith(sharedSchema) ? name.slice(sharedSchema.length) : name
}

export function truncateName(name: string): string {
  return name.length > 48 ? `${name.slice(0, 22)}…${name.slice(-23)}` : name
}

export type RefRow = { symbol: string; ref: AddedOrRemovedRef | RetargetedRef | UnresolvedRef }

export function refRows(refs: DiffResult['refs']): RefRow[] {
  return [
    ...refs.added.map((ref) => ({ symbol: '+', ref })),
    ...refs.removed.map((ref) => ({ symbol: '-', ref })),
    ...refs.retargeted.map((ref) => ({ symbol: '~', ref })),
    ...refs.unresolved.map((ref) => ({ symbol: '?', ref })),
  ]
}

export function refRowsByTable(rows: RefRow[]): Array<[string, RefRow[]]> {
  const refsByTable = rows.reduce<Record<string, RefRow[]>>((groups, row) => {
    const table = row.ref.from.table
    ;(groups[table] ??= []).push(row)
    return groups
  }, {})
  return Object.entries(refsByTable).sort(([a], [b]) => a.localeCompare(b))
}

export function refSymbolClass(symbol: string): string {
  if (symbol === '+') return 'text-emerald-500'
  if (symbol === '-') return 'text-red-500'
  if (symbol === '?') return 'text-muted-foreground'
  return 'text-amber-500'
}

export function refTargetText(ref: RefRow['ref'], displayEndpoint: (endpoint: RefEndpoint) => string): string {
  if ('to' in ref) return displayEndpoint(ref.to)
  if ('newTo' in ref) return `${displayEndpoint(ref.newTo)} (was ${displayEndpoint(ref.oldTo)})`
  if ('newTargets' in ref) return ref.newTargets.map(displayEndpoint).join(', ') || '(none)'
  return '(none)'
}

export type GroupMove = { table: string; from: string; to: string }

export function groupMoves(groups: DiffResult['groups']): GroupMove[] {
  return groups.modified.flatMap((group) =>
    group.tablesRemoved
      .filter((table) => groups.modified.some((target) => target.tablesAdded.includes(table)))
      .map((table) => ({
        table,
        from: group.name,
        to: groups.modified.find((target) => target.tablesAdded.includes(table))?.name ?? '',
      })),
  )
}

export type GroupSection = { name: string; additions: string[]; removals: string[] }

// Group membership changes, leaving out tables that moved between groups.
export function groupSections(groups: DiffResult['groups'], moves: GroupMove[]): GroupSection[] {
  const movedTables = new Set(moves.map((move) => move.table))
  return [
    ...groups.added.map((group) => ({ name: group.name, additions: group.tables, removals: [] as string[] })),
    ...groups.removed.map((group) => ({ name: group.name, additions: [] as string[], removals: group.tables })),
    ...groups.modified.map((group) => ({
      name: group.name,
      additions: group.tablesAdded.filter((table) => !movedTables.has(table)),
      removals: group.tablesRemoved.filter((table) => !movedTables.has(table)),
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))
}
