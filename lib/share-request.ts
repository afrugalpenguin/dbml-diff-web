import type { ComparisonPayload } from './diff-types'

export function shareRequestBody(comparison: Pick<ComparisonPayload, 'oldDbml' | 'newDbml'>) {
  return JSON.stringify({ oldDbml: comparison.oldDbml, newDbml: comparison.newDbml })
}
