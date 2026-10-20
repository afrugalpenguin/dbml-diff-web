import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLimit, mockSet } = vi.hoisted(() => ({
  mockLimit: vi.fn().mockResolvedValue({ success: true }),
  mockSet: vi.fn(),
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
  encodeComparison: vi.fn(() => ({ encoding: 'gzip+base64', data: 'incompressible-test-data' })),
  storedComparisonBytes: vi.fn(() => 1024 * 1024 + 1),
}))

import { POST } from './route'

describe('POST /api/share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 413 when the compressed value exceeds the Redis limit', async () => {
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
