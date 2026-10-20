import { describe, expect, it } from 'vitest'
import { shareRequestBody } from './share-request'

describe('shareRequestBody', () => {
  it('sends only the compared schemas', () => {
    const comparison = {
      id: 'abc', oldDbml: 'Table compared_a {}', newDbml: 'Table compared_b {}',
      createdAt: '2026-10-20T00:00:00.000Z', counts: { added: 0, removed: 0, modified: 0 },
      result: '{}', text: 'text', migration: 'migration', dbml: 'dbml',
    }

    expect(JSON.parse(shareRequestBody(comparison))).toEqual({ oldDbml: 'Table compared_a {}', newDbml: 'Table compared_b {}' })
  })
})
