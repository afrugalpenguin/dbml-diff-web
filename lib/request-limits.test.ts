import { beforeEach, describe, expect, it, vi } from 'vitest'

const identifiedLimit = vi.fn().mockResolvedValue({ success: true })
const missingLimit = vi.fn().mockResolvedValue({ success: true })
const limiterInstances: Array<{ limit: ReturnType<typeof vi.fn>; options: { prefix?: string; limiter?: unknown } }> = []

vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    limit: ReturnType<typeof vi.fn>
    constructor(options: { prefix?: string; limiter?: unknown }) {
      this.limit = options.prefix === 'dbml-diff:rate:missing-ip' ? missingLimit : identifiedLimit
      limiterInstances.push({ limit: this.limit, options })
    }
    static slidingWindow(requests: number, window: string) { return { requests, window } }
  },
}))

describe('request IP rate-limit buckets', () => {
  beforeEach(() => {
    identifiedLimit.mockClear()
    missingLimit.mockClear()
  })

  it('uses x-real-ip through the helper and ignores forwarded headers at the route key boundary', async () => {
    const { rateLimitForRequest } = await import('./request-limits')
    const first = new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '198.51.100.1' } })
    const second = new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '198.51.100.2' } })
    await rateLimitForRequest(first, 'diff')
    await rateLimitForRequest(second, 'diff')
    expect(identifiedLimit).toHaveBeenNthCalledWith(1, 'diff:203.0.113.10')
    expect(identifiedLimit).toHaveBeenNthCalledWith(2, 'diff:203.0.113.10')
  })

  it('uses one stricter shared bucket when the IP is missing or invalid', async () => {
    const { rateLimitForRequest } = await import('./request-limits')
    await rateLimitForRequest(new Request('http://localhost'), 'diff')
    await rateLimitForRequest(new Request('http://localhost'), 'diff')
    expect(missingLimit).toHaveBeenNthCalledWith(1, 'diff:missing')
    expect(missingLimit).toHaveBeenNthCalledWith(2, 'diff:missing')
    expect(identifiedLimit).not.toHaveBeenCalled()
    const missing = limiterInstances.find(({ options }) => options.prefix === 'dbml-diff:rate:missing-ip')
    expect(missing?.options.limiter).toEqual({ requests: 10, window: '1 m' })
  })
})
