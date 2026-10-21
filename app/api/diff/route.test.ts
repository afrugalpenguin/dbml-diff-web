import { describe, expect, it, vi } from 'vitest'
import { diff, emitJson } from 'dbml-diff'
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
const enumRefOld = readFileSync('enum-ref-v1.dbml', 'utf8')
const enumRefNew = readFileSync('enum-ref-v2.dbml', 'utf8')
const refAddRemoveOld = readFileSync('ref-add-remove-v1.dbml', 'utf8')
const refAddRemoveNew = readFileSync('ref-add-remove-v2.dbml', 'utf8')
const groupOld = readFileSync('group-v1.dbml', 'utf8')
const groupNew = readFileSync('group-v2.dbml', 'utf8')

describe('/api/diff route contract', () => {
  it('returns a successful comparison response', async () => {
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml, newDbml })))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ parsedResult: expect.any(Object), text: expect.any(String) }))
  })

  it('returns 400 for empty schemas', async () => {
    const response = await postDiff(requestWithBody(JSON.stringify({ oldDbml: '', newDbml: '' })))
    expect(response.status).toBe(400)
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
