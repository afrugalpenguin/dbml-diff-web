import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { diff, emitJson } from 'dbml-diff'
import { readFileSync } from 'node:fs'
import { Summary } from '../../page'
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

const oldDbml = readFileSync('test/fixtures/v1.dbml', 'utf8')
const newDbml = readFileSync('test/fixtures/v2.dbml', 'utf8')
const enumRefOld = readFileSync('test/fixtures/enum-ref-v1.dbml', 'utf8')
const enumRefNew = readFileSync('test/fixtures/enum-ref-v2.dbml', 'utf8')
const refAddRemoveOld = readFileSync('test/fixtures/ref-add-remove-v1.dbml', 'utf8')
const refAddRemoveNew = readFileSync('test/fixtures/ref-add-remove-v2.dbml', 'utf8')
const groupOld = readFileSync('test/fixtures/group-v1.dbml', 'utf8')
const groupNew = readFileSync('test/fixtures/group-v2.dbml', 'utf8')

describe('/api/diff comparison contract', () => {
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

  it('reports the expected fixture counts', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    expect(result.tables.added).toHaveLength(1)
    expect(result.tables.removed).toHaveLength(1)
    expect(result.tables.modified).toHaveLength(4)
    expect(result.groups.added).toHaveLength(1)
    expect(result.groups.removed).toHaveLength(0)
    expect(result.groups.modified).toHaveLength(0)
  })

  it('reports no differences for identical schemas', () => {
    const result = JSON.parse(emitJson(diff(oldDbml, oldDbml)))
    expect(result.tables.added).toHaveLength(0)
    expect(result.tables.removed).toHaveLength(0)
    expect(result.tables.modified).toHaveLength(0)
    expect(result.groups.added).toHaveLength(0)
    expect(result.groups.removed).toHaveLength(0)
    expect(result.groups.modified).toHaveLength(0)
  })

  it('renders enum and ref changes in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(enumRefOld, enumRefNew)))
    const markup = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts }))
    expect(markup.replace(/<[^>]+>/g, '')).toContain('~ modified dbo.Status (pending, active, archived)')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('Orders~user_id→Accounts.id (was Users.id)')
  })

  it('renders added and removed refs in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(refAddRemoveOld, refAddRemoveNew)))
    const text = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
    expect(text).toContain('Child+id→Other.id')
    expect(text).toContain('-parent_id→Parent.id')
    expect(parsed.refs.unresolved).toHaveLength(0)
  })

  it('renders removed and modified group membership changes in the summary', () => {
    const parsed = JSON.parse(emitJson(diff(groupOld, groupNew)))
    const text = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts })).replace(/<[^>]+>/g, '')
    expect(text).toContain('Groups')
    expect(text).toContain('dbo.C')
    expect(text).toContain('Changed')
    expect(text).toContain('dbo.A')
    expect(text).toContain('Removed')
  })

  it('renders the full fixture summary without treating columns as React children', () => {
    const parsed = JSON.parse(emitJson(diff(oldDbml, newDbml)))
    const markup = renderToStaticMarkup(createElement(Summary, { parsed, counts: parsed.counts }))
    expect(markup).toContain('ZoneId -&gt; GeoZoneId')
    expect(markup).toContain('(heuristic - verify)')
    expect(markup).toContain('+ column PlanKindId INT NOT NULL')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('+PlanKind')
    expect(markup.replace(/<[^>]+>/g, '')).toContain('Lookups')
    expect(markup).toContain('Groups')
  })
})
