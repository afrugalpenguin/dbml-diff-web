import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'

const { mockLimit, mockSet, mockEncode } = vi.hoisted(() => ({
  mockLimit: vi.fn().mockResolvedValue({ success: true }),
  mockSet: vi.fn(),
  mockEncode: vi.fn((comparison) => comparison),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {}
    }

    limit = mockLimit
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    set = mockSet
  },
}))

vi.mock('dbml-diff', () => ({
  diff: vi.fn(() => ({ server: 'diff' })),
  emitJson: vi.fn(() => JSON.stringify({ counts: { added: 1 }, server: true })),
  emitText: vi.fn(() => 'server text'),
  emitMigration: vi.fn(() => 'server migration'),
  emitDbml: vi.fn(() => 'server dbml'),
}))

vi.mock('../../../lib/share-storage', () => ({
  MAX_REDIS_VALUE_BYTES: 1024 * 1024,
  encodeComparison: mockEncode,

  storedComparisonBytes: vi.fn(() => 100),
}))

import { POST } from './route'
import { encodeComparison, storedComparisonBytes } from '../../../lib/share-storage'

const oldDbml = readFileSync('ref-add-remove-v1.dbml', 'utf8')
const newDbml = readFileSync('ref-add-remove-v2.dbml', 'utf8')

function share(body: unknown) {
  return POST(new Request('http://localhost/api/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('POST /api/share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores server-computed output instead of forged client fields', async () => {
    const response = await POST(new Request('http://localhost/api/share', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oldDbml: 'Table old {}', newDbml: 'Table new {}', text: 'forged text', migration: 'forged migration', dbml: 'forged dbml', parsedResult: { forged: true } }),
    }))
    expect(response.status).toBe(200)
    expect(mockEncode).toHaveBeenCalledWith(expect.objectContaining({ oldDbml: 'Table old {}', newDbml: 'Table new {}', text: 'server text', migration: 'server migration', dbml: 'server dbml', parsedResult: { counts: { added: 1 }, server: true } }))
  })

  it('returns 413 when the compressed value exceeds the Redis limit', async () => {
    const { storedComparisonBytes } = await import('../../../lib/share-storage')
    vi.mocked(storedComparisonBytes).mockReturnValue(1024 * 1024 + 1)
    const response = await POST(new Request('http://localhost/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        oldDbml: 'Table old {}',
        newDbml: 'Table new {}',
        parsedResult: { counts: {} },
        text: 'comparison output',
      }),
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: 'This comparison is too large to share. It is still available on screen.',
    })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('stores server-computed output and ignores client-supplied results', async () => {
    vi.mocked(storedComparisonBytes).mockReturnValueOnce(100)
    const result = diff(oldDbml, newDbml)

    const response = await share({
      oldDbml,
      newDbml,
      parsedResult: { counts: { added: 99, removed: 99, modified: 99 } },
      text: 'TAMPERED text',
      migration: 'TAMPERED migration',
      dbml: 'TAMPERED dbml',
    })

    expect(response.status).toBe(200)
    const stored = vi.mocked(encodeComparison).mock.calls[0][0] as Record<string, unknown>
    expect(stored.oldDbml).toBe(oldDbml)
    expect(stored.newDbml).toBe(newDbml)
    expect(stored.text).toBe(emitText(result))
    expect(stored.migration).toBe(emitMigration(result))
    expect(stored.dbml).toBe(emitDbml(result))
    expect(stored.parsedResult).toEqual(JSON.parse(emitJson(result)))
    expect(mockSet).toHaveBeenCalledWith(`comparison:${stored.id}`, expect.anything(), { ex: 60 * 60 * 24 * 30 })
  })

  it('returns 400 and stores nothing when a schema is missing', async () => {
    const response = await share({ oldDbml, text: 'TAMPERED text', parsedResult: { counts: {} } })

    expect(response.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns 400 and stores nothing when a schema is not a string', async () => {
    const response = await share({ oldDbml, newDbml: 42, text: 'TAMPERED text', parsedResult: { counts: {} } })

    expect(response.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns 400 and stores nothing when a schema is invalid DBML', async () => {
    const response = await share({ oldDbml, newDbml: 'Table broken { id int [pk', text: 'TAMPERED text', parsedResult: { counts: {} } })

    expect(response.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })
})
