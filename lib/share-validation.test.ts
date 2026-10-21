import { describe, expect, it } from 'vitest'
import { decodeStoredComparison, isValidShareId } from './share-validation'

describe('share validation', () => {
  it('accepts only generated-format share IDs', () => {
    expect(isValidShareId('Abc123_-XY')).toBe(true)
    expect(isValidShareId('too-short')).toBe(false)
    expect(isValidShareId('Abc123_-XYZ')).toBe(false)
    expect(isValidShareId('Abc123/XY!')).toBe(false)
  })

  it('validates a complete stored comparison', () => {
    const stored = { id: 'Abc123_-XY', oldDbml: '', newDbml: '', createdAt: '2026-01-01T00:00:00.000Z', parsedResult: {}, text: '', migration: '', dbml: '' }
    expect(decodeStoredComparison(stored)).not.toBeNull()
  })

  it.each([
    ['missing value', null],
    ['missing text', { createdAt: '2026-01-01T00:00:00.000Z' }],
    ['invalid date', { id: 'Abc123_-XY', oldDbml: '', newDbml: '', createdAt: 'not-a-date', parsedResult: {}, text: '', migration: '', dbml: '' }],
  ])('rejects %s', (_, value) => {
    expect(decodeStoredComparison(value)).toBeNull()
  })
})
