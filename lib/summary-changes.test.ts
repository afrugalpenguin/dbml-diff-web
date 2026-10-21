import { describe, expect, it } from 'vitest'
import { compareSchemas } from './compare'
import { attentionItems, changeTarget, tableDetailRows } from './summary-changes'
import type { DiffResult } from './diff-types'

function rowsMatching(parsed: DiffResult, target: string) {
  return parsed.tables.modified.flatMap(tableDetailRows).filter((row) => row.target === target)
}

describe('Summary change targets', () => {
  it('match exactly one row when one column name is a prefix of another', () => {
    const parsed = compareSchemas(
      'Table t {\n  id int\n  "Total" money\n  "Total money" money\n  c int\n  cd int\n}',
      'Table t {\n  id int\n  c bigint [not null]\n  cd bigint [not null]\n}',
    ).parsedResult
    const items = attentionItems(parsed)
    expect(items.map((item) => item.target)).toEqual(expect.arrayContaining([
      changeTarget('t', 'Total', 'removed'), changeTarget('t', 'Total money', 'removed'),
      changeTarget('t', 'c', 'modified'), changeTarget('t', 'cd', 'modified'),
    ]))
    for (const item of items) expect(rowsMatching(parsed, item.target!)).toHaveLength(1)
  })

  it('target a rename separately from the removed column it came from', () => {
    const parsed = compareSchemas('Table t {\n  id int\n  a int\n}', 'Table t {\n  id int\n  b int\n}').parsedResult
    const rename = attentionItems(parsed).find((item) => item.text.includes('looks like a rename'))
    expect(rename?.target).toBe(changeTarget('t', 'a', 'renamed'))
    expect(rowsMatching(parsed, rename!.target!).map((row) => row.kind)).toEqual(['renamed'])
  })

  it('leave a removed table without a row target', () => {
    const parsed = compareSchemas('Table t {\n  id int\n}', '').parsedResult
    expect(attentionItems(parsed)).toEqual([expect.objectContaining({ id: 'table-t', target: undefined })])
  })
})
