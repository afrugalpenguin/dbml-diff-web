import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
