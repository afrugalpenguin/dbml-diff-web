import { diff, emitJson } from 'dbml-diff'
import type { DiffResult, GraphColumn, GraphRef, GraphTable, ModifiedTable, RefEndpoint, SchemaGraph, TableEntry } from './diff-types'

// Diffing a schema against an empty one lists all of its tables and refs.
function wholeSchema(oldDbml: string, newDbml: string): DiffResult {
  return JSON.parse(emitJson(diff(oldDbml, newDbml))) as DiffResult
}

const refKey = (from: RefEndpoint, to: RefEndpoint) => JSON.stringify([from.table, from.columns, to.table, to.columns])

function modifiedColumns(schemaB: TableEntry, change: ModifiedTable): GraphColumn[] {
  const added = new Set(change.columnsAdded.map((column) => column.name))
  const changed = new Set(change.columnsChanged.map(({ column }) => column.name))
  const renamedFrom = new Map(change.renames.map((rename) => [rename.to.name, rename.from.name]))
  return [
    ...schemaB.columns.map((column): GraphColumn => {
      if (added.has(column.name)) return { ...column, kind: 'added' }
      if (changed.has(column.name)) return { ...column, kind: 'changed' }
      const from = renamedFrom.get(column.name)
      if (from !== undefined) return { ...column, kind: 'renamed', renamedFrom: from }
      return { ...column, kind: 'unchanged' }
    }),
    ...change.columnsRemoved.map((column): GraphColumn => ({ ...column, kind: 'removed' })),
  ]
}

// Built only from dbml-diff's structured output: the diff itself plus each schema diffed against an empty one.
export function schemaGraph(oldDbml: string, newDbml: string, parsed: DiffResult): SchemaGraph {
  const schemaB = wholeSchema('', newDbml)
  const schemaA = wholeSchema(oldDbml, '')
  const added = new Set(parsed.tables.added.map((table) => table.name))
  const modified = new Map(parsed.tables.modified.map((table) => [table.name, table]))
  const removed = new Set(parsed.tables.removed.map((table) => table.name))

  const tables: GraphTable[] = [
    ...schemaB.tables.added.map((table): GraphTable => {
      const change = modified.get(table.name)
      if (change) return { name: table.name, kind: 'modified', columns: modifiedColumns(table, change) }
      const kind = added.has(table.name) ? 'added' : 'unchanged'
      return { name: table.name, kind, columns: table.columns.map((column) => ({ ...column, kind })) }
    }),
    ...schemaA.tables.removed
      .filter((table) => removed.has(table.name))
      .map((table): GraphTable => ({
        name: table.name,
        kind: 'removed',
        columns: table.columns.map((column) => ({ ...column, kind: 'removed' })),
      })),
  ]

  const addedRefs = new Set(parsed.refs.added.map((ref) => refKey(ref.from, ref.to)))
  const retargetedRefs = new Set(parsed.refs.retargeted.map((ref) => refKey(ref.from, ref.newTo)))
  const refs: GraphRef[] = [
    ...schemaB.refs.added.map((ref): GraphRef => {
      const key = refKey(ref.from, ref.to)
      const kind = addedRefs.has(key) ? 'added' : retargetedRefs.has(key) ? 'retargeted' : 'unchanged'
      return { from: ref.from, to: ref.to, kind }
    }),
    ...parsed.refs.removed.map((ref): GraphRef => ({ from: ref.from, to: ref.to, kind: 'removed' })),
  ]

  return { tables, refs, unresolved: parsed.refs.unresolved.length }
}
