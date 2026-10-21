import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { diff, emitJson } from 'dbml-diff'
import { compareSchemas } from './compare'
import type { DiffResult } from './diff-types'

const cases: Array<[string, string, string]> = [
  ['fixtures', readFileSync('test/fixtures/v1.dbml', 'utf8'), readFileSync('test/fixtures/v2.dbml', 'utf8')],
  [
    'type and nullability',
    'Table users {\n  id int\n  a int [not null]\n  b int\n  c int\n}',
    'Table users {\n  id int\n  a int\n  b int [not null]\n  c bigint [not null]\n}',
  ],
  ['default schema normalised', 'Table users {\n  id int\n}', 'Table public.users {\n  id bigint\n}'],
  ['quoted names', 'Table "Order Items" {\n  "Unit Price" int\n}', 'Table "Order Items" {\n  "Unit Price" decimal\n}'],
  ['became PK', 'Table users {\n  id int\n}', 'Table users {\n  id int [pk]\n}'],
]

vi.mock('dbml-diff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dbml-diff')>()
  return { ...actual, diff: vi.fn(actual.diff) }
})

describe('compareSchemas', () => {
  it('takes before values from the package without a second diff', () => {
    vi.mocked(diff).mockClear()
    compareSchemas('Table users { id int }', 'Table users { id bigint }')
    expect(diff).toHaveBeenCalledTimes(1)
  })

  it('adds structured before values for changed columns', () => {
    const change = compareSchemas('Table users { id int }', 'Table users { id bigint }').parsedResult.tables.modified[0]?.columnsChanged[0]
    expect(change?.before).toEqual(expect.objectContaining({ name: 'id', type: 'int' }))
    expect(change?.column).toEqual(expect.objectContaining({ name: 'id', type: 'bigint' }))
  })

  it.each(cases)('has the same before column as a reversed diff: %s', (_, oldDbml, newDbml) => {
    const forward = compareSchemas(oldDbml, newDbml).parsedResult
    const reversed = JSON.parse(emitJson(diff(newDbml, oldDbml))) as DiffResult
    const changed = forward.tables.modified.flatMap((table) => table.columnsChanged.map((change) => ({ table: table.name, change })))
    expect(changed.length).toBeGreaterThan(0)
    for (const { table, change } of changed) {
      const reversedColumn = reversed.tables.modified
        .find((candidate) => candidate.name === table)
        ?.columnsChanged.find((candidate) => candidate.column.name === change.column.name)?.column
      expect(reversedColumn).toBeDefined()
      expect(change.before).toEqual(reversedColumn)
    }
  })
})
