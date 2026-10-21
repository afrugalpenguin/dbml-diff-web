import { matchesQuery, type TableChange } from './summary-groups'

export type ChangeFilter = 'All' | 'Added' | 'Removed' | 'Modified'
export type KindFilter = 'All' | 'Tables' | 'Groups' | 'Enums' | 'Refs'
export type SummaryFilters = { changeFilter: ChangeFilter; kindFilter: KindFilter; query: string }

export function tableVisible(table: TableChange, filters: SummaryFilters): boolean {
  return (
    (filters.changeFilter === 'All' || filters.changeFilter === table.kind) &&
    (filters.kindFilter === 'All' || filters.kindFilter === 'Tables') &&
    matchesQuery(filters.query, table.item.name)
  )
}

// The filters to use when jumping to a table: only the ones that would hide it are cleared.
export function summaryJump(table: TableChange, filters: SummaryFilters): SummaryFilters {
  return {
    changeFilter: filters.changeFilter === 'All' || filters.changeFilter === table.kind ? filters.changeFilter : 'All',
    kindFilter: filters.kindFilter === 'All' || filters.kindFilter === 'Tables' ? filters.kindFilter : 'All',
    query: matchesQuery(filters.query, table.item.name) ? filters.query : '',
  }
}
