import type { ColumnChange, DiffResult, ModifiedTable } from './diff-types'

export type ChangeKind = 'added' | 'removed' | 'modified' | 'renamed'

export const changeSymbol: Record<ChangeKind, string> = { added: '+', removed: '-', modified: '~', renamed: '~' }
export const changeClass: Record<ChangeKind, string> = {
  added: 'text-emerald-500',
  removed: 'text-red-500',
  modified: 'text-amber-500',
  renamed: 'text-amber-500',
}

// Identifies one column change in the Summary, so a jump can highlight exactly that row.
export function changeTarget(table: string, column: string, kind: ChangeKind): string {
  return JSON.stringify([table, column, kind])
}

export function formatColumn(column: ColumnChange): string {
  return `${column.name}${column.type ? ` ${column.type}` : ''}${column.notNull ? ' NOT NULL' : ''}`
}

export type TableDetailRow = { target: string; kind: ChangeKind; text: string }

export function tableDetailRows(table: ModifiedTable): TableDetailRow[] {
  const row = (column: string, kind: ChangeKind, text: string) => ({ target: changeTarget(table.name, column, kind), kind, text })
  return [
    ...table.columnsAdded.map((column) => row(column.name, 'added', `column ${formatColumn(column)}`)),
    ...table.columnsRemoved.map((column) => row(column.name, 'removed', `column ${formatColumn(column)}`)),
    ...table.columnsChanged.map((change) => row(change.column.name, 'modified', `${formatColumn(change.column)}: ${change.changes.join(', ')}`)),
    ...table.renames.map((rename) => row(rename.from.name, 'renamed', `${rename.from.name} -> ${rename.to.name}`)),
  ]
}

export type AttentionItem = { id: string; target?: string; schema: 'old' | 'new'; text: string }

export function attentionItems(parsed: DiffResult): AttentionItem[] {
  return [
    ...parsed.tables.removed.map((table) => ({
      id: `table-${table.name}`,
      schema: 'old' as const,
      text: `${table.name} removed in B. Dropping it deletes the table and all its data.`,
      target: undefined,
    })),
    ...parsed.tables.modified.flatMap((table) => {
      const item = (column: string, kind: ChangeKind, text: string) => ({
        id: `table-${table.name}`,
        target: changeTarget(table.name, column, kind),
        schema: 'new' as const,
        text,
      })
      return [
        ...table.columnsRemoved.map((column) =>
          item(column.name, 'removed', `${table.name}.${column.name} removed in B. Dropping this column deletes its data.`)),
        ...table.columnsAdded.filter((column) => column.notNull).map((column) =>
          item(column.name, 'added', `${table.name}.${column.name} added in B as NOT NULL. This fails on existing rows without a default.`)),
        ...table.columnsChanged.flatMap(({ column, before }) => {
          // dbml-diff compares types case-insensitively, so int to INT is not a type change.
          const typeChanged = before?.type?.toLowerCase() !== column.type?.toLowerCase()
          if (!before || (!typeChanged && before.notNull === column.notNull && before.pk === column.pk)) {
            return [item(column.name, 'modified', `${table.name}.${column.name} changed in B. Review this column before migrating.`)]
          }
          const items = []
          if (before.notNull !== column.notNull && column.notNull) {
            const text = `${table.name}.${column.name} is now NOT NULL. This fails if existing rows contain nulls; add a default or backfill first.`
            items.push(item(column.name, 'modified', text))
          }
          if (typeChanged) {
            const types = `from ${before.type ?? 'unknown'} to ${column.type ?? 'unknown'}`
            const text = `${table.name}.${column.name} changes type ${types} in B. Existing values must convert; check for data loss.`
            items.push(item(column.name, 'modified', text))
          }
          return items
        }),
        ...table.renames.map((rename) =>
          item(rename.from.name, 'renamed', `${rename.from.name} -> ${rename.to.name} looks like a rename. Confirm it before running the migration.`)),
      ]
    }),
  ]
}
