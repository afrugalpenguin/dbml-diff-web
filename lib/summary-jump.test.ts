import { describe, expect, it } from 'vitest'
import { compareSchemas } from './compare'
import { tableChanges } from './summary-groups'
import { summaryJump, tableVisible, type SummaryFilters } from './summary-jump'

const parsed = compareSchemas('Table users {\n  id int\n}\nTable gone {\n  id int\n}', 'Table users {\n  id bigint\n}').parsedResult
const users = tableChanges(parsed.tables).find((entry) => entry.item.name === 'users')!
const all: SummaryFilters = { changeFilter: 'All', kindFilter: 'All', query: '' }

describe('summaryJump', () => {
  it('leaves filters alone when the table is already visible', () => {
    const filters: SummaryFilters = { changeFilter: 'Modified', kindFilter: 'Tables', query: 'use' }
    expect(summaryJump(users, filters)).toEqual(filters)
  })

  it('clears only the filters that hide the table', () => {
    expect(summaryJump(users, { changeFilter: 'Removed', kindFilter: 'Tables', query: 'use' })).toEqual({
      changeFilter: 'All',
      kindFilter: 'Tables',
      query: 'use',
    })
    expect(summaryJump(users, { ...all, kindFilter: 'Enums' })).toEqual(all)
    expect(summaryJump(users, { ...all, query: 'gone' })).toEqual(all)
  })

  it('always leaves the table visible', () => {
    for (const changeFilter of ['All', 'Added', 'Removed', 'Modified'] as const) {
      for (const kindFilter of ['All', 'Tables', 'Groups', 'Enums', 'Refs'] as const) {
        expect(tableVisible(users, summaryJump(users, { changeFilter, kindFilter, query: 'zzz' }))).toBe(true)
      }
    }
  })
})
