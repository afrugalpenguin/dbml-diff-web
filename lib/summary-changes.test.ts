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

describe('Needs attention editor focus', () => {
  const focusOf = (oldDbml: string, newDbml: string, text: string) =>
    attentionItems(compareSchemas(oldDbml, newDbml).parsedResult).find((item) => item.text.includes(text))?.focus

  it('points a removed table at Schema A', () => {
    expect(focusOf('Table t {\n  id int\n}', '', 't removed in B')).toEqual({ schema: 'old', table: 't' })
  })

  it('points a removed column at Schema A, where it still exists', () => {
    const focus = focusOf('Table t {\n  id int\n  a int\n  b int\n}', 'Table t {\n  id int\n  b int\n}', 't.a removed in B')
    expect(focus).toEqual({ schema: 'old', table: 't', column: 'a' })
  })

  it('points a NOT NULL change at the column in Schema B', () => {
    const focus = focusOf('Table t {\n  id int\n  a int\n}', 'Table t {\n  id int\n  a int [not null]\n}', 'is now NOT NULL')
    expect(focus).toEqual({ schema: 'new', table: 't', column: 'a' })
  })

  it('points a rename at the new column name in Schema B', () => {
    const focus = focusOf('Table t {\n  id int\n  a int\n}', 'Table t {\n  id int\n  b int\n}', 'looks like a rename')
    expect(focus).toEqual({ schema: 'new', table: 't', column: 'b' })
  })
})
