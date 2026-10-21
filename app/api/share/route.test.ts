import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { diff, emitDbml, emitJson, emitMigration, emitText } from 'dbml-diff'

const { mockLimit, mockSet, mockEncode, mockStoredBytes } = vi.hoisted(() => ({
  mockLimit: vi.fn().mockResolvedValue({ success: true }),
  mockSet: vi.fn(),
  mockEncode: vi.fn((comparison) => comparison),
  mockStoredBytes: vi.fn(() => 100),
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

vi.mock('../../../lib/share-storage', () => ({
  MAX_REDIS_VALUE_BYTES: 1024 * 1024,
  encodeComparison: mockEncode,
  storedComparisonBytes: mockStoredBytes,
}))

import { POST } from './route'

const oldDbml = readFileSync('test/fixtures/ref-add-remove-v1.dbml', 'utf8')
const newDbml = readFileSync('test/fixtures/ref-add-remove-v2.dbml', 'utf8')

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

  it('returns 413 before reading an oversized declared body', async () => {
    const response = await POST(new Request('http://localhost/api/share', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1) }, body: '{}' }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Request is too large.' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns 400 for a null JSON body', async () => {
    const response = await POST(new Request('http://localhost/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON request.' })
  })

  it('returns 400 for malformed request JSON', async () => {
    const response = await POST(new Request('http://localhost/api/share', { method: 'POST', body: '{' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON request.' })
  })

  it('returns a generic 500 for storage failures without the internal message', async () => {
    mockSet.mockRejectedValueOnce(new Error('redis secret details'))
    const response = await share({ oldDbml, newDbml })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to create a share link.' })
  })

  it('returns 413 when the compressed value exceeds the Redis limit', async () => {
    mockStoredBytes.mockReturnValueOnce(1024 * 1024 + 1)

    const response = await share({ oldDbml, newDbml })

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: 'This comparison is too large to share. It is still available on screen.',
    })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('stores server-computed output and ignores client-supplied results', async () => {
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
    const stored = mockEncode.mock.calls[0][0] as Record<string, unknown>
    expect(stored.oldDbml).toBe(oldDbml)
    expect(stored.newDbml).toBe(newDbml)
    expect(stored.text).toBe(emitText(result))
    expect(stored.migration).toBe(emitMigration(result))
    expect(stored.dbml).toBe(emitDbml(result))
    expect(stored.parsedResult).toEqual(JSON.parse(emitJson(result)))
    expect(JSON.stringify(stored)).not.toContain('TAMPERED')
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
