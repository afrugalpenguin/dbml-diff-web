import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { POST as postDiff } from './route'
import * as compareModule from '../../../lib/compare'

vi.mock('../../../lib/request-limits', () => ({
  MAX_SCHEMA_BYTES: 500 * 1024,
  apiRateLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
  requestIp: vi.fn(() => 'test'),
  utf8Bytes: (value: string) => new TextEncoder().encode(value).byteLength,
}))

function requestWithBody(body: BodyInit | null, contentType = 'application/json') {
  return new Request('http://localhost/api/diff', { method: 'POST', headers: { 'content-type': contentType }, body })
}

const oldDbml = readFileSync('v1.dbml', 'utf8')
const newDbml = readFileSync('v2.dbml', 'utf8')
const closedDbml = ['Table a {', '  id int', '}'].join('\n')
const unclosedDbml = ['Table a {', '  id int', '', 'Table b {', '  id int', '}'].join('\n')

describe('/api/diff route contract', () => {
  it('returns a successful comparison response', async () => {
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml, newDbml })))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ parsedResult: expect.any(Object), text: expect.any(String) }))
  })

  it('returns 400 for empty schemas', async () => {
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml: '', newDbml: '' })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Both DBML schemas are required.' })
  })

  it('returns 429 when the rate limit is exceeded', async () => {
    const requestLimits = await import('../../../lib/request-limits')
    vi.mocked(requestLimits.apiRateLimit.limit).mockResolvedValueOnce({ success: false } as never)
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml, newDbml })))
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'Rate limit exceeded. Please try again in a minute.' })
  })

  it.each([
    ['Schema A', { oldDbml: 'x'.repeat(500 * 1024 + 1), newDbml }],
    ['Schema B', { oldDbml, newDbml: 'x'.repeat(500 * 1024 + 1) }],
  ])('returns 413 when %s is over 500 KB', async (_, body) => {
    const response = await postDiff(requestWithBody(JSON.stringify(body)))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Each schema must be 500 KB or smaller.' })
  })

  it.each([
    ['old', { oldDbml: unclosedDbml, newDbml: closedDbml }],
    ['new', { oldDbml: closedDbml, newDbml: unclosedDbml }],
  ])('returns 400 for an unclosed block in the %s schema', async (schema, body) => {
    const response = await postDiff(requestWithBody(JSON.stringify(body)))
    expect(response.status).toBe(400)
    expect((await response.json()).diagnostic).toEqual({ schema, line: 1 })
  })

  it('returns 413 before reading an oversized declared body', async () => {
    const response = await postDiff(new Request('http://localhost/api/diff', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1) }, body: '{}' }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Request is too large.' })
  })

  it('returns 400 for a null JSON body', async () => {
    const response = await postDiff(requestWithBody('null'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON request.' })
  })

  it('returns 400 for malformed request JSON', async () => {
    const response = await postDiff(requestWithBody('{'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON request.' })
  })

  it('returns parser diagnostics without exposing internal errors', async () => {
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml: 'Table old {}', newDbml: 'Table broken { }' })))
    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toEqual(expect.any(String))
    expect(payload.error).not.toContain('internal')
    expect(payload.diagnostic).toEqual(expect.objectContaining({ schema: 'new', line: expect.any(Number) }))
  })

  it('hides rate limiter errors from clients', async () => {
    const requestLimits = await import('../../../lib/request-limits')
    vi.mocked(requestLimits.apiRateLimit.limit).mockRejectedValueOnce(new Error('redis connection details'))
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml: 'Table old {}', newDbml: 'Table new {}' })))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to compare DBML schemas.' })
  })

  it('returns a generic 500 for unexpected errors without the internal message', async () => {
    vi.spyOn(compareModule, 'compareSchemas').mockImplementationOnce(() => { throw new Error('internal parser details') })
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml: 'Table old {}', newDbml: 'Table new {}' })))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to compare DBML schemas.' })
  })

})
