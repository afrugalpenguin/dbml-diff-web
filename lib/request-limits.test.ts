import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockIpAddress = vi.fn()
const identifiedLimit = vi.fn().mockResolvedValue({ success: true })
const missingLimit = vi.fn().mockResolvedValue({ success: true })

vi.mock('@vercel/functions', () => ({ ipAddress: mockIpAddress }))
vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return {} }
    limit(key: string) {
      return key.includes(':missing') ? missingLimit(key) : identifiedLimit(key)
    }
  },
}))

describe('request IP rate-limit buckets', () => {
  beforeEach(() => {
    mockIpAddress.mockReset()
    identifiedLimit.mockClear()
    missingLimit.mockClear()
  })

  it('uses x-real-ip through the helper and ignores forwarded headers at the route key boundary', async () => {
    mockIpAddress.mockReturnValue('203.0.113.10')
    const { rateLimitForRequest } = await import('./request-limits')
    const first = new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '198.51.100.1' } })
    const second = new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '198.51.100.2' } })
    await rateLimitForRequest(first, 'diff')
    await rateLimitForRequest(second, 'diff')
    expect(identifiedLimit).toHaveBeenNthCalledWith(1, 'diff:203.0.113.10')
    expect(identifiedLimit).toHaveBeenNthCalledWith(2, 'diff:203.0.113.10')
  })

  it('uses one stricter shared bucket when the IP is missing or invalid', async () => {
    mockIpAddress.mockReturnValueOnce(undefined).mockReturnValueOnce('not-an-ip')
    const { rateLimitForRequest } = await import('./request-limits')
    await rateLimitForRequest(new Request('http://localhost'), 'diff')
    await rateLimitForRequest(new Request('http://localhost'), 'diff')
    expect(missingLimit).toHaveBeenNthCalledWith(1, 'diff:missing')
    expect(missingLimit).toHaveBeenNthCalledWith(2, 'diff:missing')
    expect(identifiedLimit).not.toHaveBeenCalled()
  })
})
