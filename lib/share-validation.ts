import type { StoredComparison } from './share-storage'

export type DecodedComparison = {
  id: string
  oldDbml: string
  newDbml: string
  createdAt: string
  parsedResult: unknown
  text: string
  migration: string
  dbml: string
}

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{10}$/

export function isValidShareId(id: string) {
  return SHARE_ID_PATTERN.test(id)
}

export function decodeStoredComparison(value: StoredComparison | unknown): DecodedComparison | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.oldDbml !== 'string' ||
    typeof candidate.newDbml !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    typeof candidate.text !== 'string' ||
    typeof candidate.migration !== 'string' ||
    typeof candidate.dbml !== 'string' ||
    !('parsedResult' in candidate)
  ) return null
  return candidate as DecodedComparison
}
