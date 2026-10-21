export type ColumnChange = {
  name: string
  type?: string
  notNull?: boolean
  pk?: boolean
  note?: string
}

export type ColumnChanged = {
  column: ColumnChange
  before?: ColumnChange
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
  // Only /api/diff adds this; shared comparisons do not store it.
  graph?: SchemaGraph
}

export type GraphTableKind = 'added' | 'removed' | 'modified' | 'unchanged'
export type GraphColumnKind = 'added' | 'removed' | 'changed' | 'renamed' | 'unchanged'
export type GraphRefKind = 'added' | 'removed' | 'retargeted' | 'unchanged'

export type GraphColumn = ColumnChange & { kind: GraphColumnKind; renamedFrom?: string }

export type GraphTable = {
  name: string
  kind: GraphTableKind
  columns: GraphColumn[]
}

export type GraphRef = AddedOrRemovedRef & { kind: GraphRefKind }

// Every table and ref in both schemas, marked with its change, for the diagram.
export type SchemaGraph = {
  tables: GraphTable[]
  refs: GraphRef[]
  unresolved: number
}
