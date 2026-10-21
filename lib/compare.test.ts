import { describe, expect, it } from 'vitest'
import { compareSchemas } from './compare'

describe('compareSchemas', () => {
  it('adds structured before values for changed columns', () => {
    const comparison = compareSchemas('Table users { id int }', 'Table users { id bigint }')
    const change = comparison.parsedResult.tables.modified[0]?.columnsChanged[0]
    expect(change?.before).toEqual(expect.objectContaining({ name: 'id', type: expect.any(String) }))
    expect(change?.column).toEqual(expect.objectContaining({ name: 'id', type: expect.any(String) }))
  })
})
