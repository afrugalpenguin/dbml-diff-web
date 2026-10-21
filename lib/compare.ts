import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'
import type { DiffResult } from './diff-types'

export function compareSchemas(oldDbml: string, newDbml: string) {
  let result
  try {
    result = diff(oldDbml, newDbml)
  } catch (error) {
    try {
      diff(oldDbml, '')
    } catch {
      if (typeof error === 'object' && error !== null) { (error as { schema?: string }).schema = 'old'; throw error }
      throw error
    }
    if (typeof error === 'object' && error !== null) { (error as { schema?: string }).schema = 'new'; throw error }
    throw error
  }
  const json = emitJson(result)
  const parsedResult = JSON.parse(json) as DiffResult
  if (parsedResult.tables.modified.some((table) => table.columnsChanged.length > 0)) {
    const oldOnly = diff(oldDbml, '')
    const oldJson = JSON.parse(emitJson(oldOnly)) as DiffResult
    const oldTables = new Map(oldJson.tables.removed.map((table) => [table.name, table]))
    for (const table of parsedResult.tables.modified) {
      const oldTable = oldTables.get(table.name)
      for (const changed of table.columnsChanged) {
        changed.before = oldTable?.columns.find((column) => column.name === changed.column.name)
      }
    }
  }
  return {
    result: json, parsedResult, counts: parsedResult.counts,
    text: emitText(result), migration: emitMigration(result), dbml: emitDbml(result),
  }
}
