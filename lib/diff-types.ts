export type ColumnChange = {
  name: string
  type?: string
  notNull?: boolean
  pk?: boolean
  note?: string
}

export type ColumnChanged = {
  column: ColumnChange
  changes: string[]
}

export type Rename = {
  from: ColumnChange
  to: ColumnChange
}

export type TableEntry = {
  name: string
  columns: ColumnChange[]
}

export type ModifiedTable = {
  name: string
  columnsAdded: ColumnChange[]
  columnsRemoved: ColumnChange[]
  columnsChanged: ColumnChanged[]
  renames: Rename[]
}

export type GroupEntry = {
  name: string
  tables: string[]
}

export type ModifiedGroup = {
  name: string
  tablesAdded: string[]
  tablesRemoved: string[]
}

export type EnumEntry = {
  name: string
  values: string[]
}

export type ModifiedEnum = {
  name: string
  valuesAdded: string[]
  valuesRemoved: string[]
}

export type RefEndpoint = {
  table: string
  columns: string[]
}

export type AddedOrRemovedRef = {
  from: RefEndpoint
  to: RefEndpoint
}

export type RetargetedRef = {
  from: RefEndpoint
  oldTo: RefEndpoint
  newTo: RefEndpoint
}

export type UnresolvedRef = {
  from: RefEndpoint
  oldTargets: RefEndpoint[]
  newTargets: RefEndpoint[]
}

export type DiffResult = {
  counts: {
    added: number
    removed: number
    modified: number
  }
  tables: {
    added: TableEntry[]
    removed: TableEntry[]
    modified: ModifiedTable[]
  }
  groups: {
    added: GroupEntry[]
    removed: GroupEntry[]
    modified: ModifiedGroup[]
  }
  enums: {
    added: EnumEntry[]
    removed: EnumEntry[]
    modified: ModifiedEnum[]
  }
  refs: {
    added: AddedOrRemovedRef[]
    removed: AddedOrRemovedRef[]
    retargeted: RetargetedRef[]
    unresolved: UnresolvedRef[]
  }
}

export type ComparisonPayload = {
  id: string
  oldDbml: string
  newDbml: string
  createdAt: string
  counts: DiffResult['counts']
  result: string
  text: string
  migration: string
  dbml: string
  parsedResult: DiffResult
}
