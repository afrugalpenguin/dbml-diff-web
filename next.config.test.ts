import { describe, expect, it } from 'vitest'
import nextConfig from './next.config.mjs'

describe('security headers', () => {
  it('applies the baseline headers to every route', async () => {
    const rules = await nextConfig.headers!()
    expect(rules).toHaveLength(1)
    expect(rules[0].source).toBe('/(.*)')
    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]))
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(headers['Content-Security-Policy']).not.toContain('api.github.com')
    expect(headers['Strict-Transport-Security']).toBeUndefined()
  })

  it('type-checks the production build', () => {
    expect(nextConfig.typescript?.ignoreBuildErrors).toBeUndefined()
  })
})
