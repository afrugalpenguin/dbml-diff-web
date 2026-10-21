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
  return {
    result: json, parsedResult, counts: parsedResult.counts,
    text: emitText(result), migration: emitMigration(result), dbml: emitDbml(result),
  }
}
