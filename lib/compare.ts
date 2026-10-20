import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'
import type { DiffResult } from './diff-types'

export function compareSchemas(oldDbml: string, newDbml: string) {
  const result = diff(oldDbml, newDbml)
  const json = emitJson(result)
  const parsedResult = JSON.parse(json) as DiffResult
  return {
    result: json, parsedResult, counts: parsedResult.counts,
    text: emitText(result), migration: emitMigration(result), dbml: emitDbml(result),
  }
}
